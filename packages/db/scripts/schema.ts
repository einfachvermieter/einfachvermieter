/**
 * Schema-Verwaltung für den aktiven Dialekt (libsql/Postgres/MariaDB).
 *   tsx scripts/schema.ts fresh  -> Drop + Create (Dev-Reset)
 *   tsx scripts/schema.ts create -> nur Create
 *   tsx scripts/schema.ts drop   -> nur Drop
 */

import { initOrm } from "../src/orm.js";

const action = process.argv[2] ?? "fresh";
const orm = await initOrm();

try {
  await orm.schema.ensureDatabase();

  if (action === "fresh" || action === "drop") {
    await orm.schema.drop({ dropMigrationsTable: true });
  }

  if (action === "fresh" || action === "create") {
    await orm.schema.create();
  }

  console.log(`schema ${action}: ok (${orm.em.getDriver().constructor.name})`);
} finally {
  await orm.close(true);
}
