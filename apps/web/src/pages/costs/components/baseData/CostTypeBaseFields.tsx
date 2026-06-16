import { RiFireLine, RiHomeGearLine } from "@remixicon/react";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Disclose } from "@/components/common/Disclose";
import { CheckboxInput } from "@/components/form/CheckboxInput";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import type { Building } from "../../../../lib/buildings";
import {
  costTypeCategoryLabel,
  laborCostCategoryLabel,
} from "../../../../lib/costs";
import { t } from "../../../../lib/i18n";
import { AllocationKeySelectField } from "./AllocationKeySelectField";
import {
  ALLOCATION_KEY_NONE,
  type CostTypeFormValues,
  LABOR_CATEGORY_NONE,
} from "./costTypeForm.schema";

const CATEGORY_TILES = [
  { value: "operating" as const, icon: RiHomeGearLine },
  { value: "heating" as const, icon: RiFireLine },
];
const LABOR_CATEGORY_OPTIONS = [
  LABOR_CATEGORY_NONE,
  "craftsman",
  "household_service",
] as const;

export const CostTypeBaseFields = ({
  form,
  buildings,
  buildingFieldDisabled,
}: {
  form: UseFormReturn<CostTypeFormValues>;
  buildings: Building[];
  buildingFieldDisabled: boolean;
}) => {
  const selectedCategory = form.watch("category");
  const isHeating = selectedCategory === "heating";
  const hasLaborCategory =
    form.getValues("laborCostCategory") !== LABOR_CATEGORY_NONE;

  useEffect(() => {
    if (
      isHeating &&
      form.getValues("defaultAllocationKey") !== ALLOCATION_KEY_NONE
    ) {
      form.setValue("defaultAllocationKey", ALLOCATION_KEY_NONE);
    }
    // CO2-Erfassung gibt es nur für Heizkosten, bei Wechsel auf
    // Betriebskosten das Flag zurücksetzen, sonst bliebe ein unsichtbarer
    // Wert im Formular stehen.
    if (!isHeating && form.getValues("co2Tracked")) {
      form.setValue("co2Tracked", false);
    }
  }, [isHeating, form]);

  return (
    <FieldGroup className="gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectInput
          control={form.control}
          name="buildingId"
          label={t("ui.buildings.title")}
          disabled={buildingFieldDisabled}
          options={buildings.map((building) => ({
            value: building.id,
            label: building.name,
          }))}
        />
        <TextInput
          control={form.control}
          name="name"
          label={t("ui.common.columns.name")}
          placeholder={t("ui.costs.typeFields.namePlaceholder")}
        />
      </div>

      <ChoiceTilesInput
        control={form.control}
        name="category"
        label={t("ui.costs.typeFields.category")}
        options={CATEGORY_TILES.map((tile) => ({
          value: tile.value,
          icon: tile.icon,
          title: costTypeCategoryLabel(tile.value),
          description: t(
            `ui.costs.typeFields.categoryDescription.${tile.value}`,
          ),
        }))}
      />

      {isHeating ? null : (
        <AllocationKeySelectField
          control={form.control}
          name="defaultAllocationKey"
        />
      )}

      <Disclose
        label={t("ui.costs.detail.taxDisclose")}
        defaultOpen={hasLaborCategory}
      >
        <SelectInput
          control={form.control}
          name="laborCostCategory"
          label={t("ui.costs.typeFields.laborCostCategory")}
          description2={t("ui.costs.typeFields.laborCostCategoryDescription")}
          options={LABOR_CATEGORY_OPTIONS.map((value) => ({
            value,
            label:
              value === LABOR_CATEGORY_NONE
                ? t("ui.costs.laborCostCategoryOptions.__none__")
                : laborCostCategoryLabel(value),
          }))}
        />
      </Disclose>

      {isHeating ? (
        <CheckboxInput
          control={form.control}
          name="co2Tracked"
          label={t("ui.costs.typeFields.co2Tracked")}
        />
      ) : null}
    </FieldGroup>
  );
};
