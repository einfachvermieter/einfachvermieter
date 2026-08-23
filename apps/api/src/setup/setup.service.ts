import {
  APP_SETTINGS_ID,
  AppSettingsSchema,
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
import { authMode, recoveryMode } from "../auth/auth-mode.js";
import { LocalAdminService } from "../auth/local-admin.service.js";
import { isRecoveryUsed } from "../auth/recovery-state.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { currentAppVersion } from "../updates/app-version.js";
import { databaseNewerThanApp } from "../updates/database-version-guard.js";

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
   * `recovery` meldet den Rücksetz-Modus, in dem nur das Passwort-Formular
   * erreichbar ist; `recoveryEmails` liefert dann die Administrator-Konten
   * zur Auswahl, `recoveryUsed` das bereits erfolgte Zurücksetzen.
   * `databaseNewerThanApp` nennt die Versionen, wenn die Datenbank zuletzt
   * von einer neueren App benutzt wurde und die App deshalb gesperrt ist.
   *
   * @returns needsSetup:true, solange noch kein Benutzer existiert
   */
  async getStatus(): Promise<SetupStatus> {
    const mode = authMode();
    const recovery = recoveryMode();
    const recoveryEmails = recovery ? await this.findAdminEmails() : [];
    const recoveryUsed = isRecoveryUsed();
    const versionLock = databaseNewerThanApp();
    if (mode === "local") {
      const settingsCount = await this.em.count(AppSettingsSchema, {});

      return {
        needsSetup: settingsCount === 0,
        authMode: mode,
        recovery,
        recoveryEmails,
        recoveryUsed,
        databaseNewerThanApp: versionLock,
      };
    }

    const userCount = await this.em.count(UserSchema, {});

    return {
      needsSetup: userCount === 0,
      authMode: mode,
      recovery,
      recoveryEmails,
      recoveryUsed,
      databaseNewerThanApp: versionLock,
    };
  }

  private async findAdminEmails(): Promise<string[]> {
    const admins = await this.em.find(
      UserSchema,
      { role: "admin" },
      { fields: ["email"], orderBy: { email: "asc" } },
    );

    return admins.map((admin) => admin.email);
  }

  /**
   * Legt beim Erststart den ersten Admin (Pflicht, außer im `local`-Modus),
   * optional die Absender-Einstellungen und die Internet-Einwilligungen an.
   * Ist die Einrichtung bereits erledigt, wird abgewiesen. Der öffentliche Endpoint
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
          lastAppVersion: currentAppVersion,
        });

      if (dto.sender) {
        em.assign(settings, {
          senderName: dto.sender.senderName,
          senderAddressStreet: dto.sender.senderAddressStreet,
          senderAddressPostalCode: dto.sender.senderAddressPostalCode,
          senderAddressCity: dto.sender.senderAddressCity,
        });
      }
      if (dto.internet) {
        em.assign(settings, {
          climateFactorsAutoFetch: dto.internet.climateFactorsAutoFetch,
          updateCheckEnabled: dto.internet.updateCheckEnabled,
          telemetryEnabled: dto.internet.telemetryEnabled,
        });
      }
      em.persist(settings);

      if (local) {
        // Kein neues Konto: der automatisch angelegte lokale Admin ist die
        // Identität der Desktop-App.
        const admin = await this.localAdmin.ensure();

        return {
          id: admin.userId,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
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
        firstName: dto.admin.firstName.trim(),
        lastName: dto.admin.lastName.trim(),
        passwordHash: await hashPassword(dto.admin.password),
        role: "admin",
        residentId: null,
      });
      em.persist(user);

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        residentId: user.residentId,
      };
    });
  }
}
