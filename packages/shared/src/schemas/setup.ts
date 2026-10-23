import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { type PasswordPolicy, passwordSchema } from "./password.js";

/**
 * Antwort von `GET /api/setup/status`. `authMode` steuert im Frontend, ob
 * Login/Abmelden/Passwort sichtbar sind und ob der Assistent den
 * Admin-Konto-Schritt zeigt (`local` = Desktop-App ohne Login).
 * `recovery` meldet den per Umgebungsvariable gestarteten Rücksetz-Modus:
 * dann ist nur das Formular für ein neues Passwort erreichbar, und
 * `recoveryEmails` nennt die Administrator-Konten zur Auswahl (sonst leer).
 * `recoveryUsed` heißt: in diesem Prozess wurde bereits ein Passwort gesetzt,
 * ein zweites Mal geht erst nach einem Neustart.
 * `databaseNewerThanApp` ist gesetzt, wenn die Datenbank zuletzt von einer
 * neueren App-Version benutzt wurde: die App ist dann gesperrt und zeigt nur
 * den Hinweis, die aktuelle Version zu installieren.
 * `migrationFailed` ist gesetzt, wenn die Aktualisierung der Datenbank beim
 * Start gescheitert ist: die App ist dann gesperrt und zeigt nur den Rückweg.
 * `privacyUrl` ist die verlinkte Datenschutzerklärung (`PRIVACY_URL`); leer
 * bedeutet, dass die App keinen Link anzeigt. `licenseUrl` ebenso für den
 * Lizenztext (`LICENSE_URL`).
 */
export type SetupStatus = {
  needsSetup: boolean;
  authMode: "session" | "local";
  privacyUrl: string;
  licenseUrl: string;
  recovery: boolean;
  recoveryEmails: string[];
  recoveryUsed: boolean;
  databaseNewerThanApp: { lastVersion: string; currentVersion: string } | null;
  migrationFailed: MigrationFailure | null;
};

/**
 * Gescheiterte Einrichtung oder Aktualisierung der Datenbank beim Start.
 * `lastVersion` ist die Version, die die Datenbank davor benutzt hat
 * (unbekannt: `null`), `migration` die Migration, in der es scheiterte
 * (`null`, wenn erst das gemeinsame Abschließen scheiterte). `state` sagt,
 * was die API festgestellt hat:
 * - `setupFailed`: Erststart, vor dem Versuch gab es weder eine angewendete
 *   Migration noch Tabellen.
 * - `setupBlocked`: keine angewendete Migration, aber schon Tabellen. Ob das
 *   eine abgebrochene Ersteinrichtung oder ein beschädigter Bestand ist,
 *   lässt sich nicht unterscheiden.
 * - `rolledBack`: die Datenbank ist auf dem Stand von vorher.
 * - `unknown`: nicht feststellbar, auf MariaDB immer.
 * - `backupFailed`: schon die Sicherung scheiterte, die Migration lief nicht.
 *
 * `backupFile` ist der Dateiname der Sicherung in `backups/` im Datenordner,
 * die es nur bei SQLite gibt.
 */
export type MigrationFailure = {
  lastVersion: string | null;
  currentVersion: string;
  migration: string | null;
  database: "libsql" | "postgresql" | "mariadb";
  state:
    | "setupFailed"
    | "setupBlocked"
    | "rolledBack"
    | "unknown"
    | "backupFailed";
  backupFile: string | null;
};

/**
 * Eingabe des Erststart-Assistenten. Schritt 1 (Admin-Konto) ist Pflicht,
 * außer im `local`-Auth-Modus (`requireAdmin: false`, die Desktop-App hat
 * keinen Login); Absender und Internet-Einwilligungen sind überspringbar. Der Endpoint ist serverseitig hart gesperrt,
 * sobald die Einrichtung erledigt ist.
 * Das Admin-Passwort wird gegen die (per ENV konfigurierbare) Policy geprüft.
 */
export const makeSetupSchema = (
  policy: PasswordPolicy,
  options?: { requireAdmin?: boolean },
) =>
  z.object({
    admin: z
      .object({
        firstName: z
          .string()
          .min(1, messageKey("validation.required"))
          .max(100, messageKey("validation.tooLong", { max: 100 })),
        lastName: z
          .string()
          .min(1, messageKey("validation.required"))
          .max(100, messageKey("validation.tooLong", { max: 100 })),
        email: z.string().email(messageKey("ui.setup.validation.emailFormat")),
        password: passwordSchema(policy),
      })
      .optional()
      .refine(
        (admin) => admin !== undefined || options?.requireAdmin === false,
        {
          message: messageKey("validation.required"),
        },
      ),
    sender: z
      .object({
        senderName: z
          .string()
          .max(200, messageKey("validation.tooLong", { max: 200 })),
        senderAddressStreet: z
          .string()
          .max(200, messageKey("validation.tooLong", { max: 200 })),
        senderAddressPostalCode: z
          .string()
          .max(20, messageKey("validation.tooLong", { max: 20 })),
        senderAddressCity: z
          .string()
          .max(100, messageKey("validation.tooLong", { max: 100 })),
      })
      .optional(),
    // Einwilligungen für Internetzugriffe (Opt-in).
    internet: z
      .object({
        climateFactorsAutoFetch: z.boolean(),
        updateCheckEnabled: z.boolean(),
        telemetryEnabled: z.boolean(),
      })
      .optional(),
  });

export type SetupDto = z.infer<ReturnType<typeof makeSetupSchema>>;
