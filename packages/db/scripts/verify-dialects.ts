/**
 * Verifikation: dieselbe EntitySchema-Definition erzeugt korrektes,
 * lauffähiges DDL für alle drei Engines. Aufruf:
 *   tsx scripts/verify-dialects.ts <libsql|postgresql|mariadb>
 * Verbindungsdaten kommen aus DATABASE_URL (bzw. Dateipfad bei libsql).
 */

import { MikroORM } from "@mikro-orm/core";
import { createOrmOptions, type Dialect } from "../src/mikro-orm/config.js";

const dialect = (process.argv[2] ?? "libsql") as Dialect;
process.env.DB_DRIVER = dialect;

const orm = await MikroORM.init(await createOrmOptions());

const sql = await orm.schema.getCreateSchemaSQL();
console.log(`\n===== CREATE SCHEMA (${dialect}) =====\n`);
console.log(sql);

console.log(`----- führe DDL real aus (${dialect}) ... -----`);
await orm.schema.ensureDatabase();
await orm.schema.drop({ dropMigrationsTable: true });
await orm.schema.create();
console.log(`OK: Schema für ${dialect} erfolgreich angelegt.`);

await orm.close(true);
