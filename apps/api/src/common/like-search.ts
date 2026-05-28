import { raw } from "@mikro-orm/core";

/**
 * Escaped LIKE-Wildcards
 */
const escapeLike = (value: string) =>
  value.toLowerCase().replace(/[\\%_]/gu, (char) => `\\${char}`);

/**
 * Case-insensitive "Enthält"-Filterfragment für eine Spalte. Escaped
 * LIKE-Wildcards (`%`, `_`, `\`) über eine explizite `ESCAPE`-Klausel.
 * Notwendig für SQLite, wird auch von Postgres und MariaDB akzeptiert.
 */
export const likeContains = (column: string, query: string) => ({
  [raw(
    (alias) => `lower(${alias}.${column}) like ? escape '\\'`,
    [`%${escapeLike(query)}%`],
  )]: [],
});
