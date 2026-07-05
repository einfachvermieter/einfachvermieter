import { isCo2SplitInapplicableFuel } from "@einfachvermieter/shared";
import { RiFireLine, RiHomeGearLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Disclose } from "@/components/common/Disclose";
import { CheckboxInput } from "@/components/form/CheckboxInput";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { ReadonlyField } from "@/components/form/ReadonlyField";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import type { Building } from "../../../../lib/buildings";
import {
  costTypeCategoryLabel,
  laborCostCategoryLabel,
} from "../../../../lib/costs";
import { heatingSettingsListQueryOptions } from "../../../../lib/heating";
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
  const buildingId = form.watch("buildingId");
  const co2Tracked = form.watch("co2Tracked");
  const hasLaborCategory =
    form.getValues("laborCostCategory") !== LABOR_CATEGORY_NONE;

  // Warnung: CO2-Erfassung angehakt, aber keine Heizkosten-Konfiguration
  // dieses Gebäudes nutzt die CO2-Aufteilung mit einem CO2-pflichtigen
  // Brennstoff.
  const heatingConfigs = useQuery({
    ...heatingSettingsListQueryOptions(buildingId),
    enabled: isHeating && co2Tracked === true && Boolean(buildingId),
  });

  const anyConfigUsesCo2 = (heatingConfigs.data ?? []).some(
    (config) =>
      config.co2CostShareEnabled &&
      !isCo2SplitInapplicableFuel(config.fuelType),
  );

  const showCo2NoConfigHint =
    isHeating &&
    co2Tracked === true &&
    heatingConfigs.isSuccess &&
    !anyConfigUsesCo2;

  useEffect(() => {
    if (
      isHeating &&
      form.getValues("defaultAllocationKey") !== ALLOCATION_KEY_NONE
    ) {
      form.setValue("defaultAllocationKey", ALLOCATION_KEY_NONE);
    }
    // CO2-Erfassung gibt es nur für Heizkosten, bei Wechsel auf
    // Betriebskosten das Flag zurücksetzen
    if (!isHeating && form.getValues("co2Tracked")) {
      form.setValue("co2Tracked", false);
    }
  }, [isHeating, form]);

  return (
    <FieldGroup className="gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {buildingFieldDisabled ? (
          <ReadonlyField
            label={t("ui.buildings.title")}
            value={
              buildings.find(
                (building) => building.id === form.getValues("buildingId"),
              )?.name
            }
          />
        ) : (
          <SelectInput
            control={form.control}
            name="buildingId"
            label={t("ui.buildings.title")}
            options={buildings.map((building) => ({
              value: building.id,
              label: building.name,
            }))}
          />
        )}
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
      {showCo2NoConfigHint ? (
        <Alert variant="warning">
          <AlertDescription>
            {t("ui.costs.typeFields.co2TrackedNoConfigWarning")}
          </AlertDescription>
        </Alert>
      ) : null}
    </FieldGroup>
  );
};
