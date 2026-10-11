import { mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { dataDir, detectDialect } from "@einfachvermieter/db";
import type { MigrationFailure } from "@einfachvermieter/shared";
import type { EntityManager, MikroORM } from "@mikro-orm/core";
import { framed } from "../common/framed.js";
import { currentAppVersion } from "./app-version.js";
import { checkDatabaseVersion } from "./database-version-guard.js";

type Connection = ReturnType<MikroORM["em"]["getConnection"]>;

/**
 * Was die Aktualisierung vom ORM braucht
 */
type MigratingOrm = {
  migrator: MikroORM["migrator"];
  schema: { ensureDatabase: () => Promise<unknown> };
  em: EntityManager;
};

const STATE_LABELS: Record<MigrationFailure["state"], string> = {
  setupFailed: "Ersteinrichtung gescheitert",
  setupBlocked:
    "keine Migration angewendet, aber Tabellen vorhanden; Stand unbekannt",
  rolledBack: "zurückgenommen",
  unknown: "unklar",
  backupFailed: "Sicherung gescheitert, Aktualisierung nicht begonnen",
};

let lock: MigrationFailure | null = null;

/**
 * Liefert die gescheiterte Aktualisierung, solange die App deswegen gesperrt ist
 */
export const migrationFailure = (): MigrationFailure | null => lock;

/**
 * Version, die die Datenbank zuletzt benutzt hat. Bewusst als rohe Abfrage
 * einer einzelnen Spalte: Vor der Migration kennt die Tabelle die Spalten der
 * neuen Entities noch nicht, und beim Erststart gibt es sie gar nicht.
 */
const readLastVersion = async (
  connection: Connection,
): Promise<string | null> => {
  try {
    const [row] = await connection.execute(
      "select last_app_version from app_settings",
    );

    return (row?.last_app_version as string | null | undefined) ?? null;
  } catch {
    return null;
  }
};

const TABLE_COUNT_SQL: Record<MigrationFailure["database"], string> = {
  libsql:
    "select count(*) as table_count from sqlite_master where type = 'table' and name not like 'sqlite_%' and name <> 'mikro_orm_migrations'",
  postgresql:
    "select count(*) as table_count from information_schema.tables where table_schema = current_schema() and table_name <> 'mikro_orm_migrations'",
  mariadb:
    "select count(*) as table_count from information_schema.tables where table_schema = database() and table_name <> 'mikro_orm_migrations'",
};

/**
 * Hat die Datenbank schon Tabellen? Die Tabelle der Migrationen legt
 * MikroORM selbst an und zählt nicht.
 */
const hasTables = async (
  connection: Connection,
  database: MigrationFailure["database"],
): Promise<boolean> => {
  const [row] = await connection.execute(TABLE_COUNT_SQL[database]);

  return Number(row?.table_count ?? 0) > 0;
};

const twoDigits = (value: number): string => String(value).padStart(2, "0");

/**
 * Datum und Uhrzeit (Ortszeit) für den Dateinamen der Sicherung
 */
const backupStamp = (now: Date): string =>
  [
    now.getFullYear(),
    twoDigits(now.getMonth() + 1),
    twoDigits(now.getDate()),
    [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(twoDigits)
      .join(""),
  ].join("-");

/**
 * Sichert die SQLite-Datenbank nach `backups/` und liefert den Dateinamen.
 * `vacuum into` nimmt den Stand aus dem WAL mit. Die Kopie entsteht unter
 * einem Zwischennamen und wird erst nach Erfolg umbenannt: Eine Datei unter
 * dem endgültigen Namen ist damit immer vollständig.
 */
const backupSqlite = async (connection: Connection): Promise<string> => {
  const backupsDir = join(dataDir(), "backups");
  mkdirSync(backupsDir, { recursive: true });

  const fileName = `${currentAppVersion}-${backupStamp(new Date())}.db`;
  const target = join(backupsDir, fileName);
  const temporary = `${target}.tmp`;

  // `vacuum into` lehnt ein vorhandenes Ziel ab
  rmSync(temporary, { force: true });
  await connection.execute("vacuum into ?", [temporary]);
  renameSync(temporary, target);

  return fileName;
};

/**
 * Stellt nach dem Fehler fest, in welchem Zustand die Datenbank ist.
 *
 * War vor dem Versuch keine Migration angewendet, ist es eine Einrichtung:
 * ohne Tabellen der Erststart, mit Tabellen ein Stand, den die App nicht
 * einordnen kann (abgebrochene Ersteinrichtung auf MariaDB oder ein Bestand
 * ohne Einträge). Nur im ersten Fall ist sicher, dass keine Daten da waren.
 *
 * Sonst gilt: SQLite und PostgreSQL nehmen eine gescheiterte Migration samt
 * Eintrag zurück. Sicher ist das nur, wenn danach dieselben Migrationen
 * ausstehen wie davor: Scheitert erst die Bestätigung des Abschließens, ist
 * die Migration angewendet, obwohl sie einen Fehler gemeldet hat. MariaDB
 * schreibt jeden Schema-Befehl sofort fest, der Zustand ist dort nie bekannt.
 */
const stateAfterFailure = async (
  orm: MigratingOrm,
  before: {
    database: MigrationFailure["database"];
    pending: string[];
    applied: boolean;
    tablesPresent: boolean;
  },
): Promise<MigrationFailure["state"]> => {
  if (!before.applied) {
    return before.tablesPresent ? "setupBlocked" : "setupFailed";
  }

  if (before.database === "mariadb") {
    return "unknown";
  }

  try {
    const pendingAfter = await orm.migrator.getPending();

    return pendingAfter.map((migration) => migration.name).join() ===
      before.pending.join()
      ? "rolledBack"
      : "unknown";
  } catch {
    return "unknown";
  }
};

/**
 * Sperrt die App. Der Wortlaut des Datenbankfehlers kann Werte aus dem Bestand
 * enthalten und steht deshalb nur im Protokoll, nie in der Sperre.
 */
const lockWith = (failure: MigrationFailure, error: unknown): void => {
  lock = failure;

  const lines = [
    "Die Datenbank konnte nicht eingerichtet oder aktualisiert werden. Die App ist gesperrt.",
    `Bisherige Version: ${failure.lastVersion ?? "unbekannt"}`,
    `Laufende Version: ${failure.currentVersion}`,
    `Zustand: ${STATE_LABELS[failure.state]}`,
  ];
  if (failure.migration) {
    lines.push(`Migration: ${failure.migration}`);
  }
  if (failure.backupFile) {
    lines.push(`Sicherung: ${join(dataDir(), "backups", failure.backupFile)}`);
  }

  console.error(framed(lines));
  console.error(error);
};

/**
 * Wendet ausstehende Migrationen an. SQLite wird davor gesichert. Scheitert
 * die Sicherung oder die Migration, wirft die Funktion nicht, sondern sperrt
 * die App (siehe AppLockGuard): Der Nutzer sieht dann eine Sperrseite mit dem
 * Rückweg statt eines Absturzes bei jedem Start. Alle anderen Fehler gehen
 * nach oben und beenden den Start.
 */
export const runMigrations = async (orm: MigratingOrm): Promise<void> => {
  const pending = (await orm.migrator.getPending()).map(
    (migration) => migration.name,
  );
  if (pending.length === 0) {
    return;
  }

  const connection = orm.em.getConnection();
  const database = detectDialect();
  const applied = (await orm.migrator.getExecuted()).length > 0;
  const tablesPresent = await hasTables(connection, database);
  const failure: MigrationFailure = {
    lastVersion: await readLastVersion(connection),
    currentVersion: currentAppVersion,
    migration: null,
    database,
    state: "backupFailed",
    backupFile: null,
  };

  // Beim Erststart gibt es noch nichts zu sichern
  if (database === "libsql" && tablesPresent) {
    try {
      failure.backupFile = await backupSqlite(connection);
    } catch (error) {
      lockWith(failure, error);
      return;
    }
  }

  // Zwischen `migrating` und `migrated` läuft genau eine Migration. Scheitert
  // erst das gemeinsame Abschließen danach, ist keine einzelne schuld.
  const trackStart = ({ name }: { name: string }): void => {
    failure.migration = name;
  };
  const trackEnd = (): void => {
    failure.migration = null;
  };
  orm.migrator.on("migrating", trackStart);
  orm.migrator.on("migrated", trackEnd);

  try {
    await orm.migrator.up();
  } catch (error) {
    failure.state = await stateAfterFailure(orm, {
      database,
      pending,
      applied,
      tablesPresent,
    });
    lockWith(failure, error);
  } finally {
    orm.migrator.off("migrating", trackStart);
    orm.migrator.off("migrated", trackEnd);
  }
};

/**
 * Bringt die Datenbank beim Start auf den Stand der App: in Produktion
 * anlegen und migrieren, danach den Versionsstempel prüfen und setzen. Nach
 * einer gescheiterten Migration bleibt der Stempel der alte, und das Schema
 * passt womöglich nicht zu den Entities; die Prüfung entfällt dann.
 */
export const prepareDatabase = async (
  orm: MigratingOrm,
  options: { migrate: boolean },
): Promise<void> => {
  if (options.migrate) {
    await orm.schema.ensureDatabase();
    await runMigrations(orm);
  }

  if (!migrationFailure()) {
    await checkDatabaseVersion(orm.em);
  }
};
