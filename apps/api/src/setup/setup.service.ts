import {
  APP_SETTINGS_ID,
  AppSettingsSchema,
  BuildingSchema,
  hashPassword,
  UserSchema,
} from "@einfachvermieter/db";
import type { SetupDto, SetupStatus } from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { ConflictException, Injectable } from "@nestjs/common";
import { getI18n } from "../i18n/i18n.registry.js";

@Injectable()
export class SetupService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Signalisiert, ob die Ersteinrichtung nötig ist
   *
   * @returns needsSetup:true, solange noch kein Benutzer existiert
   */
  async getStatus(): Promise<SetupStatus> {
    const userCount = await this.em.count(UserSchema, {});

    return { needsSetup: userCount === 0 };
  }

  /**
   * Legt beim Erststart den ersten Admin (Pflicht), optional die Absender-
   * Einstellungen und ein erstes Gebäude an. Eexistiert bereits ein Benutzer,
   * wird abgewiesen. Der öffentliche Endpoint darf nach der Einrichtung
   * keine weiteren Admins anlegen können.
   */
  runSetup(dto: SetupDto) {
    return this.em.transactional(async (em) => {
      const userCount = await em.count(UserSchema, {});
      if (userCount > 0) {
        throw new ConflictException(getI18n().t("errors.setupAlreadyDone"));
      }

      const settings =
        (await em.findOne(AppSettingsSchema, { id: APP_SETTINGS_ID })) ??
        em.create(AppSettingsSchema, {
          id: APP_SETTINGS_ID,
          senderName: "",
          senderAddressStreet: "",
          senderAddressPostalCode: "",
          senderAddressCity: "",
          useLogo: false,
        });

      if (dto.sender) {
        em.assign(settings, {
          senderName: dto.sender.senderName,
          senderAddressStreet: dto.sender.senderAddressStreet,
          senderAddressPostalCode: dto.sender.senderAddressPostalCode,
          senderAddressCity: dto.sender.senderAddressCity,
        });
      }
      em.persist(settings);

      const user = em.create(UserSchema, {
        email: dto.admin.email.toLowerCase(),
        passwordHash: await hashPassword(dto.admin.password),
        role: "admin",
        residentId: null,
      });
      em.persist(user);

      if (dto.building) {
        em.persist(em.create(BuildingSchema, dto.building));
      }

      return user;
    });
  }
}
