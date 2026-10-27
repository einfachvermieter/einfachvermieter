import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Constructor, MikroORM } from "@mikro-orm/core";
import { Migration } from "@mikro-orm/migrations";
import { describe, expect, it, vi } from "vitest";
import { createOrmOptions, detectDialect } from "./mikro-orm/config.js";

// Ohne Angabe laufen die Tests auf SQLite, egal was die Umgebung vorgibt.
// Vor einem Release laufen sie von Hand auch gegen PostgreSQL und MariaDB:
// Die Variable nennt dann den Server, jeder Test legt darauf eine eigene
// Datenbank an und entfernt sie wieder. Bewusst eine eigene Variable: Die
// `DATABASE_URL` der Umgebung zeigt auf die Arbeitsdatenbank.
const serverUrl = process.env.MIGRATIONS_TEST_DATABASE_URL;
delete process.env.DB_DRIVER;
if (serverUrl) {
  process.env.DATABASE_URL = serverUrl;
} else {
  delete process.env.DATABASE_URL;
}
const dialect = detectDialect();

type MigrationEntry = { name: string; class: Constructor<Migration> };
type OpenOrm = (migrationsList?: MigrationEntry[]) => Promise<MikroORM>;

/**
 * Gibt dem Test eine eigene, leere Datenbank: auf SQLite eine Datei in einem
 * Wegwerf-Ordner, auf dem Server eine Datenbank mit zufälligem Namen. `open`
 * verbindet sich damit, auch mehrmals nacheinander.
 */
const withDatabase = async (
  run: (open: OpenOrm) => Promise<void>,
): Promise<void> => {
  const directory = mkdtempSync(join(tmpdir(), "migrations-"));
  if (serverUrl) {
    const url = new URL(serverUrl);
    url.pathname = `/ev_test_${randomBytes(6).toString("hex")}`;
    process.env.DATABASE_URL = url.toString();
  }
  const options = await createOrmOptions();
  const opened: MikroORM[] = [];

  const open: OpenOrm = async (migrationsList) => {
    const orm = await MikroORM.init({
      ...options,
      ...(serverUrl ? {} : { dbName: join(directory, "test.db") }),
      migrations: {
        ...options.migrations,
        // Im Test laufen die TS-Quellen direkt, nicht der dist-Build.
        path: options.migrations?.pathTs,
        ...(migrationsList ? { migrationsList } : {}),
      },
    });
    opened.push(orm);
    await orm.schema.ensureDatabase();

    return orm;
  };

  try {
    await run(open);
  } finally {
    for (const orm of opened) {
      await orm.close(true);
    }
    if (serverUrl) {
      const cleanup = await MikroORM.init(options);
      await cleanup.schema.dropDatabase();
      await cleanup.close(true);
    }
    rmSync(directory, { recursive: true, force: true });
  }
};

/**
 * Migration für den Test, ohne Datei
 */
const migrationOf = (
  up: (migration: Migration) => void | Promise<void>,
): Constructor<Migration> =>
  class extends Migration {
    override up(): void | Promise<void> {
      return up(this);
    }
  };

/**
 * Gibt es die Tabelle oder Spalte? Eine Abfrage darauf scheitert sonst, in
 * jedem Dialekt.
 */
const selectable = (orm: MikroORM, column: string, table: string) =>
  orm.em
    .getConnection()
    .execute(`select ${column} from ${table}`)
    .then(
      () => true,
      () => false,
    );

describe("Migrationen", () => {
  it("laufen auf einer frischen Datenbank vollständig durch", async () => {
    await withDatabase(async (open) => {
      const orm = await open();
      const applied = await orm.migrator.up();
      expect(applied.length).toBeGreaterThan(0);
    });
  });
});

describe("Abbruch einer Migration", () => {
  // MariaDB schreibt jeden Schema-Befehl sofort fest, dort bleibt alles stehen
  it.skipIf(dialect === "mariadb")(
    "nimmt alle Migrationen des Laufs samt Eintrag zurück und lässt den Bestand stehen",
    async () => {
      await withDatabase(async (open) => {
        const buildingId = crypto.randomUUID();
        const orm = await open();
        await orm.migrator.up();
        await orm.em
          .getConnection()
          .execute(
            "insert into buildings (id, name, address_street, address_postal_code, address_city) values (?, 'Bestand', 'Weg 1', '45127', 'Essen')",
            [buildingId],
          );
        await orm.close(true);

        const failing = await open([
          {
            name: "MigrationProbeOne",
            class: migrationOf((migration) =>
              migration.addSql(
                "create table rollback_probe_one (id varchar(255))",
              ),
            ),
          },
          {
            name: "MigrationProbeTwo",
            class: migrationOf(async (migration) => {
              await migration.execute(
                "create table rollback_probe_two (id varchar(255))",
              );
              throw new Error("Abbruch nach einem Schema-Befehl");
            }),
          },
        ]);
        await expect(failing.migrator.up()).rejects.toThrow();

        expect(await selectable(failing, "id", "rollback_probe_one")).toBe(
          false,
        );
        expect(await selectable(failing, "id", "rollback_probe_two")).toBe(
          false,
        );
        const executed = await failing.migrator.getExecuted();
        expect(
          executed.filter((migration) => migration.name.includes("Probe")),
        ).toEqual([]);
        const buildings = await failing.em
          .getConnection()
          .execute("select name from buildings where id = ?", [buildingId]);
        expect(buildings).toEqual([{ name: "Bestand" }]);
      });
    },
  );
});

describe("Übernahme der Werte je Abrechnungszeitraum", () => {
  type Values = [number | null, number | null, number | null];

  // Läuft auf allen drei Dialekten mit demselben Bestand. Einzige Ausnahme
  // ist die Abrechnung ohne Gebäude: PostgreSQL und MariaDB lassen sie wegen
  // der Fremdschlüssel nicht zu, der Zustand kann dort nicht entstehen. Auf
  // SQLite wird er mit abgeschalteter Prüfung hergestellt.
  it("übernimmt je Zeitraum die Werte der Version vom ersten Tag", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      await withDatabase(async (open) => {
        const orm = await open();
        const connection = orm.em.getConnection();
        const buildings = new Set<string>();

        const addBuilding = async (buildingId: string) => {
          if (buildings.has(buildingId)) {
            return;
          }
          buildings.add(buildingId);
          await connection.execute(
            "insert into buildings (id, name, address_street, address_postal_code, address_city) values (?, ?, 'Weg 1', '45127', 'Essen')",
            [buildingId, buildingId],
          );
        };
        const insertVersion = (
          buildingId: string,
          validFrom: string,
          validTo: string | null,
          values: Values,
          mode: string,
        ) =>
          connection.execute(
            "insert into heating_settings (id, building_id, mode, valid_from, valid_to, total_heat_energy_kwh, district_heat_emissions_kg_per_year, district_heat_primary_energy_factor) values (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              crypto.randomUUID(),
              buildingId,
              mode,
              validFrom,
              validTo,
              ...values,
            ],
          );
        // Jede Abrechnung bekommt eine eigene Wohnung mit eigenem Mieter
        const insertStatement = async (
          buildingId: string,
          periodStart: string,
          periodEnd: string,
          status: string,
        ) => {
          const unitId = crypto.randomUUID();
          const tenantId = crypto.randomUUID();
          await connection.execute(
            "insert into units (id, building_id, name, area_sqm) values (?, ?, ?, 50)",
            [unitId, buildingId, unitId],
          );
          await connection.execute(
            "insert into tenants (id, unit_id, start_date) values (?, ?, '2020-01-01')",
            [tenantId, unitId],
          );
          await connection.execute(
            "insert into operating_cost_statements (id, building_id, tenant_id, period_start, period_end, status) values (?, ?, ?, ?, ?, ?)",
            [
              crypto.randomUUID(),
              buildingId,
              tenantId,
              periodStart,
              periodEnd,
              status,
            ],
          );
        };
        const addVersion = async (
          buildingId: string,
          validFrom: string,
          validTo: string | null,
          values: Values,
          mode = "internal",
        ) => {
          await addBuilding(buildingId);
          await insertVersion(buildingId, validFrom, validTo, values, mode);
        };
        const addStatement = async (
          buildingId: string,
          periodStart: string,
          periodEnd: string,
          status = "draft",
        ) => {
          await addBuilding(buildingId);
          await insertStatement(buildingId, periodStart, periodEnd, status);
        };

        await orm.migrator.up({ to: "Migration20261001190126" });

        // Zwei Abrechnungen desselben Zeitraums, eine Version über zwei Jahre
        await addVersion("same-period", "2024-01-01", null, [
          42_000,
          null,
          null,
        ]);
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
        await addVersion("finalized-only", "2024-01-01", null, [
          30_000,
          5,
          null,
        ]);
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
        await addVersion("overlap-same", "2024-01-01", null, [
          7000,
          null,
          null,
        ]);
        await addVersion("overlap-same", "2024-01-02", null, [
          7000,
          null,
          null,
        ]);
        await addStatement("overlap-same", "2024-06-01", "2024-12-31");
        await addVersion("overlap-diff", "2024-01-01", null, [
          7000,
          null,
          null,
        ]);
        await addVersion("overlap-diff", "2024-01-02", null, [
          8000,
          null,
          null,
        ]);
        await addStatement("overlap-diff", "2024-06-01", "2024-12-31");

        // Abrechnung ohne Gebäude: darf die Migration nicht scheitern lassen
        if (dialect === "libsql") {
          await connection.execute("pragma foreign_keys = off");
          await insertVersion(
            "orphan",
            "2024-01-01",
            null,
            [9000, null, null],
            "internal",
          );
          await insertStatement("orphan", "2024-01-01", "2024-12-31", "draft");
        }

        await orm.migrator.up();

        const rows: Record<string, unknown>[] = await connection.execute(
          "select building_id, period_start, total_heat_energy_kwh, district_heat_emissions_kg_per_year, district_heat_primary_energy_factor from heating_period_values",
        );
        // In JS sortiert: Die Reihenfolge von Bindestrichen hängt sonst von
        // der Sortierung der Datenbank ab.
        const transferred = rows
          .map((row) => Object.values(row))
          .sort((left, right) =>
            `${left[0]} ${left[1]}` < `${right[0]} ${right[1]}` ? -1 : 1,
          );
        expect(transferred).toEqual([
          ["external", "2024-01-01", null, null, 0.5],
          ["finalized-only", "2024-01-01", 30_000, 5, null],
          ["overlap-same", "2024-06-01", 7000, null, null],
          ["same-period", "2024-01-01", 42_000, null, null],
          ["same-period", "2025-01-01", 42_000, null, null],
          ["two-versions", "2024-01-01", null, 1200, 0.28],
          ["two-versions", "2025-01-01", null, 1200, 0.28],
          ["two-versions", "2026-01-01", null, 900, 0.25],
        ]);

        expect(
          await selectable(orm, "total_heat_energy_kwh", "heating_settings"),
        ).toBe(false);

        const logged = warn.mock.calls.map((call) => String(call[0]));
        const skipped = ["no-statement", "too-late", "overlap-diff"];
        if (dialect === "libsql") {
          skipped.push("orphan");
        }
        for (const buildingId of skipped) {
          expect(
            logged.filter((line) => line.includes(buildingId)),
          ).toHaveLength(1);
        }
        expect(logged).toHaveLength(skipped.length);
      });
    } finally {
      warn.mockRestore();
    }
  });
});

describe("Grundkostenmaßstab der Heizung", () => {
  it("stellt jeden Bestand auf die beheizte Fläche um, Neues beginnt mit der Wohnfläche", async () => {
    await withDatabase(async (open) => {
      const orm = await open();
      const connection = orm.em.getConnection();
      await orm.migrator.up({ to: "Migration20261013180000" });

      await connection.execute(
        "insert into buildings (id, name, address_street, address_postal_code, address_city) values ('with-area', 'Mit Heizfläche', 'Weg 1', '45127', 'Essen'), ('without-area', 'Ohne Heizfläche', 'Weg 2', '45127', 'Essen')",
      );
      // Ohne eingetragene Heizfläche: Die Migration schaut nicht auf die
      // Wohnungen
      await connection.execute(
        "insert into units (id, building_id, name, area_sqm, heating_area_sqm) values ('unit-with', 'with-area', 'A', 80, 60), ('unit-without', 'without-area', 'B', 80, null)",
      );
      await connection.execute(
        "insert into heating_settings (id, building_id, mode, valid_from) values ('internal-with', 'with-area', 'internal', '2024-01-01'), ('internal-without', 'without-area', 'internal', '2024-01-01'), ('external', 'without-area', 'external', '2025-01-01')",
      );

      await orm.migrator.up();

      await connection.execute(
        "insert into heating_settings (id, building_id, mode, valid_from) values ('new', 'with-area', 'internal', '2026-01-01')",
      );
      const rows: Array<{ id: string; base_method: string }> =
        await connection.execute(
          "select id, base_method from heating_settings order by id",
        );
      expect(rows.map((row) => [row.id, row.base_method])).toEqual([
        ["external", "heated_area"],
        ["internal-with", "heated_area"],
        ["internal-without", "heated_area"],
        ["new", "living_area"],
      ]);
    });
  });
});

describe("Dezentrale Heizung", () => {
  it("wird zur Konfiguration ohne Heizkostenabrechnung, alles andere bleibt", async () => {
    await withDatabase(async (open) => {
      const orm = await open();
      const connection = orm.em.getConnection();
      await orm.migrator.up({ to: "Migration20261016190129" });

      await connection.execute(
        "insert into buildings (id, name, address_street, address_postal_code, address_city) values ('house', 'Haus', 'Weg 1', '45127', 'Essen')",
      );
      await connection.execute(
        "insert into units (id, building_id, name, area_sqm) values ('unit', 'house', 'A', 80)",
      );
      await connection.execute(
        "insert into tenants (id, unit_id, start_date) values ('tenant', 'unit', '2024-01-01')",
      );
      await connection.execute(
        "insert into heating_settings (id, building_id, mode, heating_type, fuel_type, valid_from, valid_to) values ('decentralized', 'house', 'internal', 'decentralized', 'oil', '2024-01-01', '2024-12-31'), ('central', 'house', 'internal', 'central_with_hot_water', 'gas', '2025-01-01', null)",
      );
      await connection.execute(
        "insert into operating_cost_statements (id, building_id, tenant_id, period_start, period_end, status, snapshot_data) values ('statement', 'house', 'tenant', '2024-01-01', '2024-12-31', 'finalized', '{\"heatingDetail\":null}')",
      );
      const statementsBefore = await connection.execute(
        "select * from operating_cost_statements",
      );

      await orm.migrator.up();

      const rows: Array<{
        id: string;
        mode: string;
        heating_type: string;
        fuel_type: string;
      }> = await connection.execute(
        "select id, mode, heating_type, fuel_type from heating_settings order by id",
      );
      expect(
        rows.map((row) => [row.id, row.mode, row.heating_type, row.fuel_type]),
      ).toEqual([
        ["central", "internal", "central_with_hot_water", "gas"],
        ["decentralized", "none", "central_without_hot_water", "oil"],
      ]);
      expect(
        await connection.execute("select * from operating_cost_statements"),
      ).toEqual(statementsBefore);
    });
  });
});

describe("Änderungsgrund und Mietart", () => {
  it("macht die Begründung zur Notiz mit Grund Vereinbarung, außer beim ersten Satz; Verträge werden standard", async () => {
    await withDatabase(async (open) => {
      const orm = await open();
      const connection = orm.em.getConnection();
      await orm.migrator.up({ to: "Migration20261021191114" });

      await connection.execute(
        "insert into buildings (id, name, address_street, address_postal_code, address_city) values ('house', 'Haus', 'Weg 1', '45127', 'Essen')",
      );
      await connection.execute(
        "insert into units (id, building_id, name, area_sqm) values ('unit', 'house', 'A', 80)",
      );
      await connection.execute(
        "insert into tenants (id, unit_id, start_date) values ('tenant', 'unit', '2024-01-01')",
      );
      await connection.execute(
        "insert into tenant_rents (id, tenant_id, start_date, end_date, monthly_base_rent_cents, monthly_advance_cents, reduction_reason) values ('a-first', 'tenant', null, '2024-06-30', 50000, 10000, 'Bestand'), ('b-blank', 'tenant', '2024-07-01', '2024-12-31', 50000, 12000, '  '), ('c-note', 'tenant', '2025-01-01', null, 45000, 12000, 'Senkung nach Absprache')",
      );

      await orm.migrator.up();

      const rents: Array<{
        id: string;
        change_reason: string | null;
        change_note: string | null;
      }> = await connection.execute(
        "select id, change_reason, change_note from tenant_rents order by id",
      );
      expect(
        rents.map((rent) => [rent.id, rent.change_reason, rent.change_note]),
      ).toEqual([
        ["a-first", null, "Bestand"],
        ["b-blank", null, "  "],
        ["c-note", "agreement", "Senkung nach Absprache"],
      ]);
      expect(await connection.execute("select rent_type from tenants")).toEqual(
        [{ rent_type: "standard" }],
      );
    });
  });
});
