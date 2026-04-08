import type { EntityName } from "@mikro-orm/core";

type DeleteRule = "restrict" | "cascade" | "set null";

type FkOptions = {
  nullable?: boolean;
  primary?: boolean;
};

/**
 * mapToPk-Relation: erzeugt eine echte FK-Constraint inkl. `onDelete`,
 * hält die Property aber als skalare Id (z. B. `buildingId: string`).
 *
 * Rückgabe ist bewusst `any`: MikroORMs strikte EntitySchema-Property-
 * Typisierung bildet `mapToPk` (Property = skalare PK, Relation zeigt auf
 * Entity-Typ) nicht ab.
 */
export const fk = (
  // biome-ignore lint/suspicious/noExplicitAny: EntitySchema nimmt jede Entity an
  ref: () => EntityName<any>,
  fieldName: string,
  deleteRule: DeleteRule,
  opts: FkOptions = {},
  // biome-ignore lint/suspicious/noExplicitAny: zentraler Cast für mapToPk-Properties
): any => ({
  kind: "m:1",
  entity: ref,
  mapToPk: true,
  fieldName,
  deleteRule,
  ...opts,
});
