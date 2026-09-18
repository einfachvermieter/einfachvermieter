export type Dialect = "libsql" | "postgresql" | "mariadb";

/**
 * Aktiver Dialekt. Explizit über `DB_DRIVER`, sonst aus dem Schema der
 * `DATABASE_URL` abgeleitet. Ohne Angabe: eingebettetes SQLite (libsql),
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
