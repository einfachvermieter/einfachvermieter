import { MikroORM } from "@mikro-orm/core";
import { describe, expect, it } from "vitest";
import { createOrmOptions } from "./mikro-orm/config.js";

describe("Migrationen", () => {
  it("laufen auf einer frischen SQLite-Datenbank vollständig durch", async () => {
    // Erzwingt den libsql-Dialekt, egal was die Umgebung vorgibt.
    delete process.env.DB_DRIVER;
    delete process.env.DATABASE_URL;

    const options = await createOrmOptions();
    const orm = await MikroORM.init({
      ...options,
      dbName: ":memory:",
      // Im Test laufen die TS-Quellen direkt, nicht der dist-Build.
      migrations: { ...options.migrations, path: options.migrations?.pathTs },
    });

    try {
      const applied = await orm.migrator.up();
      expect(applied.length).toBeGreaterThan(0);
    } finally {
      await orm.close(true);
    }
  });
});
