import type { MigrationFailure } from "@einfachvermieter/shared";
import { t } from "./i18n";

const DATABASE_NAMES: Record<MigrationFailure["database"], string> = {
  libsql: "SQLite",
  postgresql: "PostgreSQL",
  mariadb: "MariaDB",
};

const isSetup = (failure: MigrationFailure): boolean =>
  failure.state === "setupFailed" || failure.state === "setupBlocked";

/**
 * Titel der Sperrseite: Einrichtung, solange noch keine Migration angewendet
 * war, sonst Aktualisierung
 */
export const migrationFailedTitle = (failure: MigrationFailure): string =>
  isSetup(failure)
    ? t("ui.migrationFailed.setupTitle")
    : t("ui.migrationFailed.title");

/**
 * Text der Sperrseite. Was die API festgestellt hat, und den
 * dazu passenden Rückweg.
 *
 * Einrichtung: Beim Erststart gibt es nichts zurückzuholen. MariaDB kann
 * dabei einen Teil der Tabellen hinterlassen, die leere Datenbank muss dort
 * neu angelegt werden. Waren schon Tabellen da, ist nicht bekannt, ob Daten
 * darin liegen; der Text nennt dann keinen Rückweg.
 *
 * Aktualisierung: Gibt es eine Sicherung der App (nur SQLite), verweist der
 * Text auf sie, sonst auf die Sicherung des Betreibers. Ist die bisherige
 * Version unbekannt, heißt sie "die vorige Version".
 */
export const migrationFailedText = (failure: MigrationFailure): string => {
  if (failure.state === "backupFailed") {
    return t("ui.migrationFailed.backupFailed", failure);
  }

  if (failure.state === "setupFailed") {
    return failure.database === "mariadb"
      ? t("ui.migrationFailed.setupFailedRecreate")
      : t("ui.migrationFailed.setupFailed");
  }

  if (failure.state === "setupBlocked") {
    return failure.backupFile
      ? t("ui.migrationFailed.setupBlockedWithBackup", failure)
      : t("ui.migrationFailed.setupBlocked");
  }

  const key = [
    failure.state,
    failure.backupFile ? "WithBackup" : "",
    failure.lastVersion ? "" : "NoVersion",
  ].join("");

  return t(`ui.migrationFailed.${key}`, failure);
};

/**
 * Technische Angabe unter dem Text: gescheiterte Migration und Datenbank
 */
export const migrationFailedDetails = (failure: MigrationFailure): string => {
  const database = DATABASE_NAMES[failure.database];

  return failure.migration
    ? t("ui.migrationFailed.details", {
        migration: failure.migration,
        database,
      })
    : t("ui.migrationFailed.detailsNoMigration", { database });
};
