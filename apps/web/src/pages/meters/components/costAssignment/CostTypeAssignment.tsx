import {
  type MeterFormValues,
  measurementUnitFor,
} from "@einfachvermieter/shared";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { CheckboxGroupInput } from "@/components/form/CheckboxGroupInput";
import {
  type AllocationKey,
  allocationLabel,
  type CostType,
} from "../../../../lib/costs";
import { t } from "../../../../lib/i18n";
import { measurementUnitLabel } from "../../../../lib/meters";

type ConsumptionAllocationKey = Extract<
  AllocationKey,
  "per_consumption_m3" | "per_consumption_kwh"
>;

/**
 * Liefert den Verbrauchs-Umlageschlüssel für die Filterung der Kostenarten.
 * Für `units` (HKV) gibt es keinen passenden Schlüssel. HKV laufen nicht
 * über Kostenarten, sondern über das Heizkosten-Modul.
 */
const allocationKeyForUnit = (
  unit: "m3" | "kwh" | "units",
): ConsumptionAllocationKey | null => {
  if (unit === "m3") {
    return "per_consumption_m3";
  }

  if (unit === "kwh") {
    return "per_consumption_kwh";
  }

  return null;
};

export const CostTypeAssignment = ({
  form,
  costTypes,
}: {
  form: UseFormReturn<MeterFormValues>;
  costTypes: CostType[];
}) => {
  const selectedBuildingId = form.watch("buildingId");
  const selectedType = form.watch("type");
  const selectedUnit = measurementUnitFor(selectedType);
  const matchingAllocationKey = allocationKeyForUnit(selectedUnit);
  const eligibleCostTypes =
    matchingAllocationKey === null
      ? []
      : costTypes.filter(
          (costType) =>
            costType.buildingId === selectedBuildingId &&
            costType.defaultAllocationKey === matchingAllocationKey,
        );

  useEffect(() => {
    const current = form.getValues("costTypeIds");
    const eligibleIds = new Set(eligibleCostTypes.map((entry) => entry.id));
    const pruned = current.filter((id) => eligibleIds.has(id));
    if (pruned.length !== current.length) {
      form.setValue("costTypeIds", pruned);
    }
  }, [eligibleCostTypes, form]);

  return (
    <CheckboxGroupInput
      control={form.control}
      name="costTypeIds"
      label={t("ui.meters.fields.costTypes")}
      description={t("ui.meters.fields.costTypesDescription")}
      emptyMessage={t("ui.meters.fields.costTypesEmpty", {
        unit: measurementUnitLabel(selectedUnit),
      })}
      optional={true}
      options={eligibleCostTypes.map((costType) => ({
        value: costType.id,
        label: costType.name,
        description: costType.defaultAllocationKey
          ? allocationLabel(costType.defaultAllocationKey)
          : "",
      }))}
    />
  );
};
