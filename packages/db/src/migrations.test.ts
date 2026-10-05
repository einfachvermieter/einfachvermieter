import { MikroORM } from "@mikro-orm/core";
import { describe, expect, it, vi } from "vitest";
import { createOrmOptions } from "./mikro-orm/config.js";

const initMemoryOrm = async (): Promise<MikroORM> => {
  // Erzwingt den libsql-Dialekt, egal was die Umgebung vorgibt.
  delete process.env.DB_DRIVER;
  delete process.env.DATABASE_URL;

  const options = await createOrmOptions();
  return MikroORM.init({
    ...options,
    dbName: ":memory:",
    // Im Test laufen die TS-Quellen direkt, nicht der dist-Build.
    migrations: { ...options.migrations, path: options.migrations?.pathTs },
  });
};

describe("Migrationen", () => {
  it("laufen auf einer frischen SQLite-Datenbank vollständig durch", async () => {
    const orm = await initMemoryOrm();

    try {
      const applied = await orm.migrator.up();
      expect(applied.length).toBeGreaterThan(0);
    } finally {
      await orm.close(true);
    }
  });
});

describe("Übernahme der Werte je Abrechnungszeitraum", () => {
  type Values = [number | null, number | null, number | null];

  it("übernimmt je Zeitraum die Werte der Version vom ersten Tag", async () => {
    const orm = await initMemoryOrm();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const connection = orm.em.getConnection();

    let statementCount = 0;
    const addVersion = async (
      buildingId: string,
      validFrom: string,
      validTo: string | null,
      values: Values,
      mode = "internal",
    ) => {
      if (buildingId !== "orphan") {
        await connection.execute(
          "insert or ignore into buildings (id, name, address_street, address_postal_code, address_city) values (?, ?, 'Weg 1', '45127', 'Essen')",
          [buildingId, buildingId],
        );
      }
      await connection.execute(
        "insert into heating_settings (id, building_id, mode, valid_from, valid_to, total_heat_energy_kwh, district_heat_emissions_kg_per_year, district_heat_primary_energy_factor) values (?, ?, ?, ?, ?, ?, ?, ?)",
        [crypto.randomUUID(), buildingId, mode, validFrom, validTo, ...values],
      );
    };
    const addStatement = async (
      buildingId: string,
      periodStart: string,
      periodEnd: string,
      status = "draft",
    ) => {
      statementCount += 1;
      await connection.execute(
        "insert into operating_cost_statements (id, building_id, tenant_id, period_start, period_end, status) values (?, ?, ?, ?, ?, ?)",
        [
          crypto.randomUUID(),
          buildingId,
          `tenant-${statementCount}`,
          periodStart,
          periodEnd,
          status,
        ],
      );
    };

    try {
      await orm.migrator.up({ to: "Migration20261001190126" });
      // Mieter braucht der Test nicht, und ein Fall hat bewusst kein Gebäude.
      await connection.execute("pragma foreign_keys = off");

      // Zwei Abrechnungen desselben Zeitraums, eine Version über zwei Jahre
      await addVersion("same-period", "2024-01-01", null, [42_000, null, null]);
      await addStatement("same-period", "2024-01-01", "2024-12-31");
      await addStatement("same-period", "2024-01-01", "2024-12-31");
      await addStatement("same-period", "2025-01-01", "2025-12-31");

      // Zwei Versionen, die zweite beginnt mitten in der zweiten Periode
      await addVersion("two-versions", "2024-01-01", "2025-06-30", [
        null,
        1200,
        0.28,
      ]);
      await addVersion("two-versions", "2025-07-01", null, [null, 900, 0.25]);
      await addStatement("two-versions", "2024-01-01", "2024-12-31");
      await addStatement("two-versions", "2025-01-01", "2025-12-31");
      await addStatement("two-versions", "2026-01-01", "2026-12-31");

      // Nur finalisierte Abrechnung: Zeile entsteht trotzdem
      await addVersion("finalized-only", "2024-01-01", null, [30_000, 5, null]);
      await addStatement(
        "finalized-only",
        "2024-01-01",
        "2024-12-31",
        "finalized",
      );

      // Alle Werte leer; Werte ohne Abrechnung; keine Version am Stichtag
      await addVersion("empty", "2024-01-01", null, [null, null, null]);
      await addStatement("empty", "2024-01-01", "2024-12-31");
      await addVersion("no-statement", "2024-01-01", null, [
        55_000,
        null,
        null,
      ]);
      await addVersion("too-late", "2025-01-01", null, [10_000, null, null]);
      await addStatement("too-late", "2024-01-01", "2024-12-31");

      // Abrechnung ohne Gebäude: darf die Migration nicht scheitern lassen
      await addVersion("orphan", "2024-01-01", null, [9000, null, null]);
      await addStatement("orphan", "2024-01-01", "2024-12-31");

      // Externe Version mit Wert: Der Modus verwirft nichts
      await addVersion(
        "external",
        "2024-01-01",
        null,
        [null, null, 0.5],
        "external",
      );
      await addStatement("external", "2024-01-01", "2024-12-31");

      // Überlappende Versionen: gleiche Werte zählen, verschiedene nicht
      await addVersion("overlap-same", "2024-01-01", null, [7000, null, null]);
      await addVersion("overlap-same", "2024-01-02", null, [7000, null, null]);
      await addStatement("overlap-same", "2024-06-01", "2024-12-31");
      await addVersion("overlap-diff", "2024-01-01", null, [7000, null, null]);
      await addVersion("overlap-diff", "2024-01-02", null, [8000, null, null]);
      await addStatement("overlap-diff", "2024-06-01", "2024-12-31");

      await orm.migrator.up();

      const rows = await connection.execute(
        "select building_id, period_start, total_heat_energy_kwh, district_heat_emissions_kg_per_year, district_heat_primary_energy_factor from heating_period_values order by building_id, period_start",
      );
      expect(
        rows.map((row: Record<string, unknown>) => Object.values(row)),
      ).toEqual([
        ["external", "2024-01-01", null, null, 0.5],
        ["finalized-only", "2024-01-01", 30_000, 5, null],
        ["overlap-same", "2024-06-01", 7000, null, null],
        ["same-period", "2024-01-01", 42_000, null, null],
        ["same-period", "2025-01-01", 42_000, null, null],
        ["two-versions", "2024-01-01", null, 1200, 0.28],
        ["two-versions", "2025-01-01", null, 1200, 0.28],
        ["two-versions", "2026-01-01", null, 900, 0.25],
      ]);

      const columns = await connection.execute(
        "select name from pragma_table_info('heating_settings')",
      );
      expect(
        columns.map((column: { name: string }) => column.name),
      ).not.toContain("total_heat_energy_kwh");

      const logged = warn.mock.calls.map((call) => String(call[0]));
      expect(
        logged.filter((line) => line.includes("no-statement")),
      ).toHaveLength(1);
      expect(logged.filter((line) => line.includes("too-late"))).toHaveLength(
        1,
      );
      expect(
        logged.filter((line) => line.includes("overlap-diff")),
      ).toHaveLength(1);
      expect(logged.filter((line) => line.includes("orphan"))).toHaveLength(1);
      expect(logged).toHaveLength(4);
    } finally {
      warn.mockRestore();
      await orm.close(true);
    }
  });
});
