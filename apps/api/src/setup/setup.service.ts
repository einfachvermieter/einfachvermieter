import {
  APP_SETTINGS_ID,
  AppSettingsSchema,
  BuildingSchema,
  hashPassword,
  UserSchema,
} from "@einfachvermieter/db";
import type { SetupDto, SetupStatus } from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { authMode } from "../auth/auth-mode.js";
import { LocalAdminService } from "../auth/local-admin.service.js";
import { getI18n } from "../i18n/i18n.registry.js";

@Injectable()
export class SetupService {
  constructor(
    private readonly em: EntityManager,
    private readonly localAdmin: LocalAdminService,
  ) {}

  /**
   * Signalisiert, ob die Ersteinrichtung nötig ist
   *
   * Im `session`-Modus: eingerichtet, sobald ein Benutzer existiert
   * Im`local`-Modus: eingerichtet, wenn App-Einstellungen existieren
   *
   * @returns needsSetup:true, solange noch kein Benutzer existiert
   */
  async getStatus(): Promise<SetupStatus> {
    const mode = authMode();
    if (mode === "local") {
      const settingsCount = await this.em.count(AppSettingsSchema, {});

      return { needsSetup: settingsCount === 0, authMode: mode };
    }

    const userCount = await this.em.count(UserSchema, {});

    return { needsSetup: userCount === 0, authMode: mode };
  }

  /**
   * Legt beim Erststart den ersten Admin (Pflicht, außer im `local`-Modus),
   * optional die Absender-Einstellungen und ein erstes Gebäude an. Ist die
   * Einrichtung bereits erledigt, wird abgewiesen. Der öffentliche Endpoint
   * darf nach der Einrichtung keine weiteren Admins anlegen können.
   */
  runSetup(dto: SetupDto) {
    return this.em.transactional(async (em) => {
      const local = authMode() === "local";

      if (local) {
        const settingsCount = await em.count(AppSettingsSchema, {});

        if (settingsCount > 0) {
          throw new ConflictException(getI18n().t("errors.setupAlreadyDone"));
        }
      } else {
        const userCount = await em.count(UserSchema, {});

        if (userCount > 0) {
          throw new ConflictException(getI18n().t("errors.setupAlreadyDone"));
        }
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

      if (dto.building) {
        em.persist(em.create(BuildingSchema, dto.building));
      }

      if (local) {
        // Kein neues Konto: der automatisch angelegte lokale Admin ist die
        // Identität der Desktop-App.
        const admin = await this.localAdmin.ensure();

        return {
          id: admin.userId,
          email: admin.email,
          role: admin.role,
          residentId: admin.residentId,
        };
      }

      if (!dto.admin) {
        // Das Zod-Schema verlangt admin außerhalb von `local` bereits.
        throw new BadRequestException(getI18n().t("validation.required"));
      }

      const user = em.create(UserSchema, {
        email: dto.admin.email.toLowerCase(),
        passwordHash: await hashPassword(dto.admin.password),
        role: "admin",
        residentId: null,
      });
      em.persist(user);

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        residentId: user.residentId,
      };
    });
  }
}
