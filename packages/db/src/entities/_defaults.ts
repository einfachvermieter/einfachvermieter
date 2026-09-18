import { detectDialect } from "../mikro-orm/dialect.js";

/**
 * Datenbankseitiger Default für `created_at`/`updated_at`.
 *
 * MariaDB gibt den Default beim Auslesen des Schemas als `current_timestamp()`
 * zurück, SQLite und Postgres ohne Klammern.
 */
export const currentTimestamp =
  detectDialect() === "mariadb" ? "current_timestamp()" : "current_timestamp";
