import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Options, UnderscoreNamingStrategy } from "@mikro-orm/core";
import { Migrator } from "@mikro-orm/migrations";
import { entitySchemas } from "../entities/index.js";
import { resolveDbPath } from "../paths.js";

export type Dialect = "libsql" | "postgresql" | "mariadb";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Aktiver Dialekt. Explizit über `DB_DRIVER`, sonst aus dem Schema der
 * `DATABASE_URL` abgeleitet. Ohne Angabe: eingebettetes SQLite (libsql) -
 * der Zero-Config-Default für Container-mit-DB und Electron.
 */
export const detectDialect = (): Dialect => {
  const explicit = process.env.DB_DRIVER?.toLowerCase() ?? "";

  if (["postgresql", "postgres", "pg"].includes(explicit)) {
    return "postgresql";
  }

  if (["mariadb", "mysql"].includes(explicit)) {
    return "mariadb";
  }

  if (["sqlite", "libsql"].includes(explicit)) {
    return "libsql";
  }

  const url = process.env.DATABASE_URL ?? "";
  if (/^postgres(ql)?:\/\//iu.test(url)) {
    return "postgresql";
  }

  if (/^(mysql|mariadb):\/\//iu.test(url)) {
    return "mariadb";
  }

  return "libsql";
};

const commonOptions = (dialect: Dialect) => ({
  entities: entitySchemas,
  namingStrategy: UnderscoreNamingStrategy,
  extensions: [Migrator],
  migrations: {
    path: resolve(packageRoot, `dist/migrations/${dialect}`),
    pathTs: resolve(packageRoot, `src/migrations/${dialect}`),
    snapshot: false,
    emit: "ts" as const,
  },
});

/**
 * Baut die MikroORM-Optionen für den aktiven Dialekt. Server-Engines
 * (Postgres/MariaDB) verbinden über `DATABASE_URL`; SQLite/libsql nutzt
 * den aufgelösten Dateipfad.
 */
export const createOrmOptions = async (): Promise<Options> => {
  const dialect = detectDialect();
  const common = commonOptions(dialect);

  if (dialect === "postgresql") {
    const { defineConfig } = await import("@mikro-orm/postgresql");
    return defineConfig({
      ...common,
      clientUrl: process.env.DATABASE_URL,
    }) as Options;
  }

  if (dialect === "mariadb") {
    const { defineConfig } = await import("@mikro-orm/mariadb");
    return defineConfig({
      ...common,
      clientUrl: process.env.DATABASE_URL,
    }) as Options;
  }

  const { defineConfig } = await import("@mikro-orm/libsql");
  return defineConfig({ ...common, dbName: resolveDbPath() }) as Options;
};
