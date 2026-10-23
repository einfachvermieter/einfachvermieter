import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Constructor, MikroORM } from "@mikro-orm/core";
import { Migration } from "@mikro-orm/migrations";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { currentAppVersion } from "./app-version.js";

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

const BASE = {
  name: "Migration1Base",
  class: migrationOf((migration) => {
    migration.addSql("create table notes (id integer primary key, body text)");
    migration.addSql("create table app_settings (last_app_version text)");
    migration.addSql("insert into app_settings values ('2026.1.0')");
  }),
};
const ADD_COLUMN = {
  name: "Migration2AddColumn",
  class: migrationOf((migration) =>
    migration.addSql("alter table notes add column extra text"),
  ),
};
const FAILING = {
  name: "Migration3Failing",
  class: migrationOf(async (migration) => {
    await migration.execute("create table half_done (id integer)");
    throw new Error("Wert 4711 aus dem Bestand");
  }),
};

type MigrationEntry = { name: string; class: Constructor<Migration> };

/**
 * Optionen aus demselben Modulstand wie der frisch geladene Guard: Sonst
 * kennt das ORM die Entities nicht, die der Guard abfragt.
 */
const createOrmOptions = async () =>
  (await import("@einfachvermieter/db")).createOrmOptions();

/**
 * Frisch geladen, damit jeder Test ohne Sperre beginnt
 */
const loadGuard = () => {
  vi.resetModules();
  return import("./migration-guard.js");
};

let directory = "";
let errorLog = vi.spyOn(console, "error");
const openOrms: MikroORM[] = [];

const initOrm = async (
  migrationsList: MigrationEntry[],
  dbName?: string,
): Promise<MikroORM> => {
  const options = await createOrmOptions();
  const orm = await MikroORM.init({
    ...options,
    ...(dbName ? { dbName } : {}),
    migrations: { ...options.migrations, migrationsList },
  });
  openOrms.push(orm);

  return orm;
};

const backupFiles = (): string[] =>
  existsSync(join(directory, "backups"))
    ? readdirSync(join(directory, "backups"))
    : [];

const tableExists = async (orm: MikroORM, table: string): Promise<boolean> => {
  const rows = await orm.em
    .getConnection()
    .execute("select name from sqlite_master where name = ?", [table]);

  return rows.length > 0;
};

beforeAll(() => {
  delete process.env.DATABASE_URL;
});

beforeEach(() => {
  delete process.env.DB_DRIVER;
  // Leerzeichen und Hochkomma: Der Pfad der Sicherung geht als Parameter an
  // die Datenbank und darf daran nicht scheitern.
  directory = join(mkdtempSync(join(tmpdir(), "migration-guard-")), "da ta's");
  mkdirSync(directory);
  process.env.DATA_DIR = directory;
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.useRealTimers();
  errorLog.mockRestore();
  for (const orm of openOrms.splice(0)) {
    await orm.close(true);
  }
  rmSync(join(directory, ".."), { recursive: true, force: true });
});

afterAll(() => {
  delete process.env.DATA_DIR;
  delete process.env.DB_DRIVER;
});

describe("runMigrations mit SQLite", () => {
  it("migriert beim Erststart ohne Sicherung und ohne Sperre", async () => {
    const { runMigrations, migrationFailure } = await loadGuard();
    const orm = await initOrm([BASE]);

    await runMigrations(orm);

    expect(await tableExists(orm, "notes")).toBe(true);
    expect(backupFiles()).toEqual([]);
    expect(migrationFailure()).toBeNull();
  });

  it("sichert vor einer Migration mit Bestand, auch den Stand aus dem WAL", async () => {
    const { runMigrations, migrationFailure } = await loadGuard();
    const orm = await initOrm([BASE, ADD_COLUMN]);
    await orm.migrator.up({ to: BASE.name });
    // Dieselbe Verbindung bleibt offen, die Zeile steht also nur im WAL
    await orm.em
      .getConnection()
      .execute("insert into notes (body) values ('nur im WAL')");

    await runMigrations(orm);

    expect(migrationFailure()).toBeNull();
    const files = backupFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(
      new RegExp(
        `^${currentAppVersion.replaceAll(".", "\\.")}-\\d{4}-\\d{2}-\\d{2}-\\d{6}\\.db$`,
        "u",
      ),
    );

    const backup = await initOrm(
      [],
      join(directory, "backups", files[0] ?? ""),
    );
    const rows = await backup.em
      .getConnection()
      .execute("select body from notes");
    expect(rows).toEqual([{ body: "nur im WAL" }]);
    // Die Kopie ist der Stand von vor der Migration
    const columns = await backup.em
      .getConnection()
      .execute("select name from pragma_table_info('notes')");
    expect(columns.map((column: { name: string }) => column.name)).toEqual([
      "id",
      "body",
    ]);
  });

  it("sichert nicht, wenn keine Migration aussteht", async () => {
    const { runMigrations } = await loadGuard();
    const orm = await initOrm([BASE]);
    await runMigrations(orm);

    await runMigrations(orm);

    expect(backupFiles()).toEqual([]);
  });

  it("sperrt nach gescheiterter Migration, statt zu werfen", async () => {
    const { runMigrations, migrationFailure } = await loadGuard();
    const orm = await initOrm([BASE, ADD_COLUMN, FAILING]);
    await orm.migrator.up({ to: BASE.name });

    await runMigrations(orm);

    const [backupFile] = backupFiles();
    expect(migrationFailure()).toEqual({
      lastVersion: "2026.1.0",
      currentVersion: currentAppVersion,
      migration: FAILING.name,
      database: "libsql",
      state: "rolledBack",
      backupFile,
    });
    // Der ganze Lauf ist zurückgenommen, der Versionsstempel unberührt
    expect(await tableExists(orm, "half_done")).toBe(false);
    expect(
      (await orm.migrator.getPending()).map((migration) => migration.name),
    ).toEqual([ADD_COLUMN.name, FAILING.name]);
    expect(
      await orm.em
        .getConnection()
        .execute("select last_app_version from app_settings"),
    ).toEqual([{ last_app_version: "2026.1.0" }]);
  });

  it("hält den Wortlaut des Datenbankfehlers aus der Sperre heraus", async () => {
    const { runMigrations, migrationFailure } = await loadGuard();
    const orm = await initOrm([BASE, FAILING]);
    await orm.migrator.up({ to: BASE.name });

    await runMigrations(orm);

    expect(JSON.stringify(migrationFailure())).not.toContain("4711");
    expect(
      errorLog.mock.calls.some((call) => String(call[0]).includes("4711")),
    ).toBe(true);
  });

  it("sichert bei jedem Versuch neu und ersetzt eine liegengebliebene Zwischendatei", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 11, 14, 30, 0));
    const { runMigrations } = await loadGuard();
    const orm = await initOrm([BASE, FAILING]);
    await orm.migrator.up({ to: BASE.name });
    const firstName = `${currentAppVersion}-2026-10-11-143000.db`;
    mkdirSync(join(directory, "backups"));
    writeFileSync(
      join(directory, "backups", `${firstName}.tmp`),
      "abgebrochene Sicherung",
    );

    await runMigrations(orm);
    expect(backupFiles()).toEqual([firstName]);

    vi.setSystemTime(new Date(2026, 9, 11, 14, 30, 1));
    await runMigrations(orm);
    expect(backupFiles()).toEqual([
      firstName,
      `${currentAppVersion}-2026-10-11-143001.db`,
    ]);
  });

  it("migriert nicht, wenn die Sicherung scheitert", async () => {
    const { runMigrations, migrationFailure } = await loadGuard();
    const orm = await initOrm([BASE, ADD_COLUMN]);
    await orm.migrator.up({ to: BASE.name });
    // Eine Datei an der Stelle des Ordners: Die Sicherung kann nicht entstehen
    writeFileSync(join(directory, "backups"), "");

    await runMigrations(orm);

    expect(migrationFailure()).toMatchObject({
      state: "backupFailed",
      migration: null,
      backupFile: null,
    });
    expect(
      (await orm.migrator.getPending()).map((migration) => migration.name),
    ).toEqual([ADD_COLUMN.name]);
  });

  it("meldet beim Erststart eine gescheiterte Einrichtung, ohne Sicherung", async () => {
    const { runMigrations, migrationFailure } = await loadGuard();
    const orm = await initOrm([FAILING]);

    await runMigrations(orm);

    expect(migrationFailure()).toMatchObject({
      state: "setupFailed",
      migration: FAILING.name,
      lastVersion: null,
      backupFile: null,
    });
    expect(backupFiles()).toEqual([]);
  });

  it("hält Tabellen ohne angewendete Migration nicht für einen Erststart", async () => {
    const { runMigrations, migrationFailure } = await loadGuard();
    const orm = await initOrm([FAILING]);
    await orm.em
      .getConnection()
      .execute("create table unknown_origin (id integer)");

    await runMigrations(orm);

    const [backupFile] = backupFiles();
    expect(backupFile).toBeDefined();
    expect(migrationFailure()).toMatchObject({
      state: "setupBlocked",
      backupFile,
    });
  });
});

type FakeOptions = {
  pendingAfter?: () => Promise<{ name: string }[]>;
  /**
   * War vor dem Versuch schon eine Migration angewendet?
   */
  applied?: boolean;
  tableCount?: number;
  /**
   * Was `up` tut, bevor es scheitert
   */
  beforeFailing?: (emit: (event: string, name: string) => void) => void;
};

/**
 * Attrappe: `getPending` liefert erst die Liste von vor dem Versuch, danach
 * das Ergebnis von `pendingAfter`; `up` scheitert immer.
 */
const failingOrm = ({
  pendingAfter = () =>
    Promise.resolve([{ name: "MigrationA" }, { name: "MigrationB" }]),
  applied = true,
  tableCount = 5,
  beforeFailing,
}: FakeOptions = {}): MikroORM => {
  const listeners = new Map<string, Set<(event: { name: string }) => void>>();
  const emit = (event: string, name: string) => {
    for (const listener of listeners.get(event) ?? []) {
      listener({ name });
    }
  };

  return {
    migrator: {
      getPending: vi
        .fn()
        .mockResolvedValueOnce([{ name: "MigrationA" }, { name: "MigrationB" }])
        .mockImplementation(pendingAfter),
      getExecuted: () =>
        Promise.resolve(applied ? [{ name: "MigrationInitial" }] : []),
      up: () => {
        beforeFailing?.(emit);
        return Promise.reject(new Error("gescheitert"));
      },
      on: (event: string, listener: (event: { name: string }) => void) => {
        listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
      },
      off: (event: string, listener: (event: { name: string }) => void) => {
        listeners.get(event)?.delete(listener);
      },
    },
    em: {
      getConnection: () => ({
        execute: (sql: string) =>
          Promise.resolve(
            sql.includes("table_count") ? [{ table_count: tableCount }] : [],
          ),
      }),
    },
  } as unknown as MikroORM;
};

const failureFor = async (driver: string, options: FakeOptions = {}) => {
  process.env.DB_DRIVER = driver;
  const { runMigrations, migrationFailure } = await loadGuard();
  await runMigrations(failingOrm(options));

  return migrationFailure();
};

describe("Zustand nach gescheiterter Migration", () => {
  const stateFor = (
    driver: string,
    pendingAfter: () => Promise<{ name: string }[]>,
  ) => failureFor(driver, { pendingAfter });

  const unchanged = () =>
    Promise.resolve([{ name: "MigrationA" }, { name: "MigrationB" }]);

  it("ist auf PostgreSQL zurückgenommen, wenn dieselben Migrationen ausstehen", async () => {
    expect(await stateFor("postgres", unchanged)).toMatchObject({
      database: "postgresql",
      state: "rolledBack",
      backupFile: null,
    });
  });

  it("ist unklar, wenn danach weniger Migrationen ausstehen", async () => {
    const failure = await stateFor("postgres", () =>
      Promise.resolve([{ name: "MigrationB" }]),
    );
    expect(failure?.state).toBe("unknown");
  });

  it("ist unklar, wenn sich die ausstehenden Migrationen nicht mehr lesen lassen", async () => {
    const failure = await stateFor("postgres", () =>
      Promise.reject(new Error("Verbindung verloren")),
    );
    expect(failure?.state).toBe("unknown");
  });

  it("ist auf MariaDB immer unklar", async () => {
    expect(await stateFor("mariadb", unchanged)).toMatchObject({
      database: "mariadb",
      state: "unknown",
    });
  });
});

describe("Erststart auf dem Datenbank-Server", () => {
  it("ist eine gescheiterte Einrichtung, wenn nichts da war", async () => {
    for (const driver of ["postgres", "mariadb"]) {
      const failure = await failureFor(driver, {
        applied: false,
        tableCount: 0,
      });
      expect(failure?.state).toBe("setupFailed");
    }
  });

  it("ist kein Erststart, wenn schon Tabellen da waren", async () => {
    for (const driver of ["postgres", "mariadb"]) {
      const failure = await failureFor(driver, {
        applied: false,
        tableCount: 3,
      });
      expect(failure?.state).toBe("setupBlocked");
    }
  });
});

describe("Name der gescheiterten Migration", () => {
  it("ist die Migration, die gerade lief", async () => {
    const failure = await failureFor("postgres", {
      beforeFailing: (emit) => {
        emit("migrating", "MigrationA");
        emit("migrated", "MigrationA");
        emit("migrating", "MigrationB");
      },
    });
    expect(failure?.migration).toBe("MigrationB");
  });

  it("bleibt leer, wenn erst das gemeinsame Abschließen scheitert", async () => {
    const failure = await failureFor("postgres", {
      beforeFailing: (emit) => {
        emit("migrating", "MigrationA");
        emit("migrated", "MigrationA");
        emit("migrating", "MigrationB");
        emit("migrated", "MigrationB");
      },
    });
    expect(failure?.migration).toBeNull();
  });
});

describe("prepareDatabase", () => {
  /**
   * Echte Datenbank mit dem Schema der App, gestempelt mit einer alten
   * Version
   */
  const seedInstallation = async (lastVersion: string): Promise<void> => {
    const orm = await MikroORM.init(await createOrmOptions());
    openOrms.push(orm);
    await orm.migrator.up();
    await orm.em
      .getConnection()
      .execute(
        "insert into app_settings (id, sender_name, sender_address_street, sender_address_postal_code, sender_address_city, logo_mode, last_app_version) values ('default', '', '', '', '', 'app', ?)",
        [lastVersion],
      );
  };

  const stampOf = async (orm: MikroORM): Promise<unknown> => {
    const [row] = await orm.em
      .getConnection()
      .execute("select last_app_version from app_settings");

    return row?.last_app_version;
  };

  it("lässt den Versionsstempel nach gescheiterter Migration, wie er war", async () => {
    const { prepareDatabase, migrationFailure } = await loadGuard();
    await seedInstallation("2020.1.0");
    const orm = await initOrm([FAILING]);

    await prepareDatabase(orm, { migrate: true });

    expect(migrationFailure()).toMatchObject({
      lastVersion: "2020.1.0",
      state: "rolledBack",
    });
    expect(currentAppVersion).not.toBe("2020.1.0");
    expect(await stampOf(orm)).toBe("2020.1.0");
  });

  it("stempelt nach gelungener Migration die laufende Version", async () => {
    const { prepareDatabase, migrationFailure } = await loadGuard();
    await seedInstallation("2020.1.0");
    const orm = await initOrm([
      {
        name: "MigrationHarmless",
        class: migrationOf((migration) =>
          migration.addSql("create table harmless (id integer)"),
        ),
      },
    ]);

    await prepareDatabase(orm, { migrate: true });

    expect(migrationFailure()).toBeNull();
    expect(await stampOf(orm)).toBe(currentAppVersion);
  });

  it("bricht ab, ohne zu sperren, wenn die Datenbank nicht angelegt werden kann", async () => {
    const { prepareDatabase, migrationFailure } = await loadGuard();
    const getPending = vi.fn();
    const orm = {
      schema: {
        ensureDatabase: () => Promise.reject(new Error("nicht erreichbar")),
      },
      migrator: { getPending },
    } as unknown as MikroORM;

    await expect(prepareDatabase(orm, { migrate: true })).rejects.toThrow(
      "nicht erreichbar",
    );
    expect(migrationFailure()).toBeNull();
    expect(getPending).not.toHaveBeenCalled();
  });
});

describe("Fehler vor der Aktualisierung", () => {
  it("gehen nach oben und sperren nicht", async () => {
    const { runMigrations, migrationFailure } = await loadGuard();
    const orm = {
      migrator: {
        getPending: vi.fn().mockRejectedValue(new Error("nicht erreichbar")),
      },
    } as unknown as MikroORM;

    await expect(runMigrations(orm)).rejects.toThrow("nicht erreichbar");
    expect(migrationFailure()).toBeNull();
  });
});
