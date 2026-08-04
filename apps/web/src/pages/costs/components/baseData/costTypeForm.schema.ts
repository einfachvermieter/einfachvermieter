import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import type {
  CostTypeAllocationKey,
  CostTypeCategory,
  LaborCostCategory,
} from "../../../../lib/costs";

export const ALLOCATION_KEY_NONE = "__none__";
export const LABOR_CATEGORY_NONE = "__none__";

/**
 * Im Formular wählbare Verteilerschlüssel. Bewusst ohne `heating_ordinance`
 * (verbrauchsabhängige Heizkosten laufen nicht über die Kostenart) und ohne
 * `per_consumption_kwh` (noch nicht implementiert).
 */
export const costTypeAllocationKeySchema = z.enum([
  ALLOCATION_KEY_NONE,
  "per_living_area",
  "per_heating_area",
  "per_person",
  "per_unit",
  "per_consumption_m3",
  "fixed",
]);

export const costTypeFormSchema = z
  .object({
    buildingId: z
      .string()
      .min(1, messageKey("ui.costs.validation.buildingRequired"))
      .pipe(z.guid()),
    name: z
      .string()
      .min(1, messageKey("ui.form.nameRequired"))
      .max(200, messageKey("validation.tooLong", { max: 200 })),
    category: z.enum(["operating", "heating"]),
    defaultAllocationKey: costTypeAllocationKeySchema,
    laborCostCategory: z.enum([
      LABOR_CATEGORY_NONE,
      "craftsman",
      "household_service",
    ]),
    co2Tracked: z.boolean(),
    isMeteringServiceCost: z.boolean(),
  })
  .refine(
    (data) =>
      data.category !== "operating" ||
      data.defaultAllocationKey !== ALLOCATION_KEY_NONE,
    {
      message: messageKey("ui.costs.validation.allocationKeyRequired"),
      path: ["defaultAllocationKey"],
    },
  );

export type CostTypeFormValues = z.infer<typeof costTypeFormSchema>;

export type CostTypeSubmitValues = {
  buildingId: string;
  name: string;
  category: CostTypeCategory;
  defaultAllocationKey: CostTypeAllocationKey | null;
  laborCostCategory: LaborCostCategory | null;
  co2Tracked: boolean;
  isMeteringServiceCost: boolean;
  description: string | null;
};

export const costTypeFormToDto = (
  values: CostTypeFormValues,
): CostTypeSubmitValues => ({
  buildingId: values.buildingId,
  name: values.name,
  category: values.category,
  defaultAllocationKey:
    values.category === "heating" ||
    values.defaultAllocationKey === ALLOCATION_KEY_NONE
      ? null
      : values.defaultAllocationKey,
  laborCostCategory:
    values.laborCostCategory === LABOR_CATEGORY_NONE
      ? null
      : values.laborCostCategory,
  // CO2-Erfassung und Erfassungsentgelt-Kennzeichen gibt es nur für
  // Heizkostenarten; bei anderen Kategorien werden die Flags verworfen,
  // selbst wenn sie im Formular noch gesetzt waren.
  co2Tracked: values.category === "heating" ? values.co2Tracked : false,
  isMeteringServiceCost:
    values.category === "heating" ? values.isMeteringServiceCost : false,
  description: null,
});
