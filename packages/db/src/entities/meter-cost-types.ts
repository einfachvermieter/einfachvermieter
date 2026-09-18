import { EntitySchema, type Opt } from "@mikro-orm/core";
import { currentTimestamp } from "./_defaults.js";
import { fk } from "./_relations.js";
import { CostTypeSchema } from "./costs.js";
import { MeterSchema } from "./meters.js";

/**
 * Ein Zähler kann mehreren Kostenarten als Messquelle zugeordnet sein
 * (z. B. ein Wasser-Hauptzähler für Frisch- und Abwasser).
 */
export type MeterCostTypeAssignment = {
  meterId: string;
  costTypeId: string;
  createdAt: Opt<string>;
};

export const MeterCostTypeAssignmentSchema =
  new EntitySchema<MeterCostTypeAssignment>({
    name: "MeterCostTypeAssignment",
    tableName: "meter_cost_type_assignments",
    properties: {
      meterId: fk(() => MeterSchema, "meter_id", "cascade", { primary: true }),
      costTypeId: fk(() => CostTypeSchema, "cost_type_id", "cascade", {
        primary: true,
      }),
      createdAt: {
        type: "string",
        fieldName: "created_at",
        defaultRaw: currentTimestamp,
      },
    },
  });
