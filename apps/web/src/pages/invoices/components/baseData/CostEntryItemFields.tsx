import { containedTaxKinds } from "@einfachvermieter/shared";
import { RiFundsLine, RiPriceTag3Line } from "@remixicon/react";
import { useEffect } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { Disclose } from "@/components/common/Disclose";
import { CheckboxGroupInput } from "@/components/form/CheckboxGroupInput";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { DateInput } from "@/components/form/DateInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import type { CostType } from "../../../../lib/costs";
import { t } from "../../../../lib/i18n";
import type { Unit } from "../../../../lib/units";
import {
  type CostEntryFormValues,
  unitPriceDisplayConfig,
} from "./costEntryForm.schema";

/**
 * Felder einer Rechnungsposition. Welche Felder erscheinen, hängt an der
 * gewählten Kostenart: Wohnung nur bei Pauschalen, Lohnkosten nur bei
 * § 35a-Kostenarten, CO2 nur bei CO2-Erfassung, Steuern nur bei Heizkosten.
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt am Markup
export const CostEntryItemFields = ({
  form,
  index,
  costTypes,
  units,
}: {
  form: UseFormReturn<CostEntryFormValues>;
  index: number;
  costTypes: CostType[];
  units: Unit[];
}) => {
  const selectedCostTypeId = useWatch({
    control: form.control,
    name: `items.${index}.costTypeId`,
  });
  const priceMode = useWatch({
    control: form.control,
    name: `items.${index}.priceMode`,
  });
  const selectedCostType = costTypes.find(
    (costType) => costType.id === selectedCostTypeId,
  );
  const allocationKey = selectedCostType?.defaultAllocationKey ?? null;
  const displayConfig = unitPriceDisplayConfig(
    selectedCostType?.category ?? null,
    allocationKey,
  );
  const unitSuffix = displayConfig?.suffix ?? null;

  // Bei Pauschal-Kostenarten (`fixed`) ohne sinnvolle Einheit wird die
  // Preisart-Auswahl ausgeblendet und der Modus auf "fixed" gepinnt.
  const showPriceModeToggle = unitSuffix !== null;

  useEffect(() => {
    if (!showPriceModeToggle && priceMode !== "fixed") {
      form.setValue(`items.${index}.priceMode`, "fixed", { shouldDirty: true });
    }
  }, [showPriceModeToggle, priceMode, form, index]);

  const showUnitPriceInput =
    showPriceModeToggle && priceMode === "per_unit" && unitSuffix !== null;
  const showLaborCostsInput = Boolean(selectedCostType?.laborCostCategory);
  const showCo2Inputs = selectedCostType?.co2Tracked === true;

  // Enthaltene Steuern/Abgaben gibt es nur bei Heiz-Positionen.
  const showContainedTaxesInput = selectedCostType?.category === "heating";

  // Pauschal-Kostenarten (`fixed`) werden einer einzelnen Wohnung direkt
  // berechnet. Die Wohnung ist dann Pflichtfeld. Auswahl auf die Wohnungen
  // des Gebäudes der Kostenart beschränken.
  const isFixed = allocationKey === "fixed";

  const unitOptions = selectedCostType
    ? units
        .filter((unit) => unit.buildingId === selectedCostType.buildingId)
        .map((unit) => ({ value: unit.id, label: unit.name }))
    : [];

  // Wechselt die Position auf eine nicht-pauschale Kostenart, die
  // Wohnungs-Zuordnung verwerfen. Sonst landet ein unsichtbarer Wert im
  // Submit.
  useEffect(() => {
    if (!isFixed) {
      form.setValue(`items.${index}.unitId`, "", { shouldDirty: true });
    }
  }, [isFixed, form, index]);

  // Wenn die Kostenart auf "nicht begünstigt" gewechselt wird, etwaige
  // bereits eingegebene Lohnkosten zurücksetzen. Sonst landet ein
  // unsichtbarer Wert im Submit.
  useEffect(() => {
    if (!showLaborCostsInput) {
      form.setValue(`items.${index}.laborCostsInput`, "", {
        shouldDirty: true,
      });
    }
  }, [showLaborCostsInput, form, index]);

  // Wechselt die Position auf eine Kostenart ohne CO2-Erfassung, die
  // CO2-Eingaben verwerfen. Sonst landet ein unsichtbarer Wert im Submit.
  useEffect(() => {
    if (!showCo2Inputs) {
      form.setValue(`items.${index}.co2AmountInput`, "", { shouldDirty: true });
      form.setValue(`items.${index}.co2CostInput`, "", { shouldDirty: true });
    }
  }, [showCo2Inputs, form, index]);

  // Wechselt die Position auf eine Nicht-Heiz-Kostenart, die Steuern-/
  // Abgaben-Eingabe verwerfen. Sonst landet ein unsichtbarer Wert im Submit.
  useEffect(() => {
    if (!showContainedTaxesInput) {
      form.setValue(`items.${index}.containedTaxesInput`, "", {
        shouldDirty: true,
      });
      form.setValue(`items.${index}.containedTaxKinds`, [], {
        shouldDirty: true,
      });
    }
  }, [showContainedTaxesInput, form, index]);

  return (
    <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <SelectInput
          control={form.control}
          name={`items.${index}.costTypeId`}
          label={t("ui.costs.entryFields.costType")}
          options={costTypes.map((costType) => ({
            value: costType.id,
            label: costType.name,
          }))}
        />
      </div>
      {isFixed ? (
        <div className="sm:col-span-2">
          <SelectInput
            control={form.control}
            name={`items.${index}.unitId`}
            label={t("ui.costs.entryFields.unit")}
            description={t("ui.costs.entryFields.unitDescription")}
            placeholder={t("ui.costs.entryFields.unitPlaceholder")}
            options={unitOptions}
          />
        </div>
      ) : null}
      <TextInput
        control={form.control}
        name={`items.${index}.amountInput`}
        label={t("ui.costs.entryFields.amountGross")}
        inputMode="decimal"
        placeholder={t("ui.common.placeholders.amount")}
        suffix="€"
      />
      <div className="hidden sm:block" />
      <DateInput
        control={form.control}
        name={`items.${index}.periodStart`}
        label={t("ui.costs.entryFields.periodFrom")}
      />
      <DateInput
        control={form.control}
        name={`items.${index}.periodEnd`}
        label={t("ui.costs.entryFields.periodTo")}
      />
      {showPriceModeToggle ? (
        <div className="sm:col-span-2">
          <Disclose
            label={t("ui.invoices.detail.moreOptions")}
            defaultOpen={priceMode === "per_unit"}
          >
            <div className="space-y-4">
              <ChoiceTilesInput
                control={form.control}
                name={`items.${index}.priceMode`}
                options={[
                  {
                    value: "fixed",
                    icon: RiPriceTag3Line,
                    title: t("ui.costs.entryFields.priceModeFixed"),
                    description: t(
                      "ui.costs.entryFields.priceModeFixedDescription",
                    ),
                  },
                  {
                    value: "per_unit",
                    icon: RiFundsLine,
                    title: t("ui.costs.entryFields.priceModePerUnit"),
                    description: t(
                      "ui.costs.entryFields.priceModePerUnitDescription",
                    ),
                  },
                ]}
              />
              {showUnitPriceInput && unitSuffix ? (
                <TextInput
                  control={form.control}
                  name={`items.${index}.unitPriceInput`}
                  label={t("ui.costs.entryFields.unitPrice")}
                  description={t("ui.costs.entryFields.unitPriceDescription")}
                  inputMode="decimal"
                  placeholder={t("ui.common.placeholders.unitPrice")}
                  suffix={unitSuffix}
                />
              ) : null}
            </div>
          </Disclose>
        </div>
      ) : null}
      {showLaborCostsInput ? (
        <div className="sm:col-span-2">
          <TextInput
            control={form.control}
            name={`items.${index}.laborCostsInput`}
            label={t("ui.costs.entryFields.laborCosts")}
            description={t("ui.costs.entryFields.laborCostsDescription")}
            inputMode="decimal"
            placeholder={t("ui.costs.entryFields.laborCostsPlaceholder")}
            suffix="€"
          />
        </div>
      ) : null}
      {showCo2Inputs ? (
        <>
          <TextInput
            control={form.control}
            name={`items.${index}.co2AmountInput`}
            label={t("ui.costs.entryFields.co2Amount")}
            description={t("ui.costs.entryFields.co2AmountDescription")}
            optional={true}
            inputMode="decimal"
            placeholder={t("ui.common.placeholders.quantity")}
            suffix="kg"
          />
          <TextInput
            control={form.control}
            name={`items.${index}.co2CostInput`}
            label={t("ui.costs.entryFields.co2Cost")}
            description={t("ui.costs.entryFields.co2CostDescription")}
            optional={true}
            inputMode="decimal"
            placeholder={t("ui.common.placeholders.amount")}
            suffix="€"
          />
        </>
      ) : null}
      {showContainedTaxesInput ? (
        <>
          <div className="sm:col-span-2">
            <TextInput
              control={form.control}
              name={`items.${index}.containedTaxesInput`}
              label={t("ui.costs.entryFields.containedTaxes")}
              description={t("ui.costs.entryFields.containedTaxesDescription")}
              optional={true}
              inputMode="decimal"
              placeholder={t("ui.common.placeholders.amount")}
              suffix="€"
            />
          </div>
          <div className="sm:col-span-2">
            <CheckboxGroupInput
              control={form.control}
              name={`items.${index}.containedTaxKinds`}
              label={t("ui.costs.entryFields.containedTaxKinds")}
              description={t(
                "ui.costs.entryFields.containedTaxKindsDescription",
              )}
              optional={true}
              options={containedTaxKinds.map((kind) => ({
                value: kind,
                label: t(`ui.costs.taxKinds.${kind}`),
              }))}
            />
          </div>
        </>
      ) : null}
    </FieldGroup>
  );
};
