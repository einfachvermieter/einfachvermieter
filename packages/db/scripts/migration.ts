/**
 * Migrations-CLI für den aktiven Dialekt. Die Migrationsdateien sind pro
 * Dialekt getrennt (`src/migrations/<dialect>/`), weil das DDL je Engine
 * unterschiedlich ist.
 *   tsx scripts/migration.ts create -> neue Migration aus Entity-Diff
 *   tsx scripts/migration.ts up     -> ausstehende Migrationen anwenden
 *   tsx scripts/migration.ts down   -> letzte Migration zurückrollen
 */

import { initOrm } from "../src/orm.js";

const action = process.argv[2] ?? "up";
const orm = await initOrm();
try {
  const { migrator } = orm;

  if (action === "create") {
    const result = await migrator.create();

    console.log(
      result.fileName
        ? `migration erstellt: ${result.fileName}`
        : "keine Schema-Änderungen - keine Migration erstellt",
    );
  } else if (action === "down") {
    await migrator.down();
    console.log("letzte Migration zurückgerollt");
  } else {
    const applied = await migrator.up();

    console.log(
      applied.length > 0
        ? `${applied.length} Migration(en) angewendet`
        : "keine ausstehenden Migrationen",
    );
  }
} finally {
  await orm.close(true);
}
