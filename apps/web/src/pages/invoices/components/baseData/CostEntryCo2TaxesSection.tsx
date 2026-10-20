import {
  co2BasisMismatchKg,
  containedTaxKinds,
  formatNumberLoose,
} from "@einfachvermieter/shared";
import { useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { CheckboxGroupInput } from "@/components/form/CheckboxGroupInput";
import { SubSheet } from "@/components/form/SubSheet";
import { SubSheetRow } from "@/components/form/SubSheetRow";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import {
  type CostEntryFormValues,
  parseOptionalDecimal,
} from "./costEntryForm.schema";

/**
 * Felder des SubSheets "CO2 und Steuern"
 */
const CO2_TAX_FIELDS = [
  "co2AmountInput",
  "co2CostInput",
  "co2EnergyInput",
  "co2EmissionFactorInput",
  "containedTaxesInput",
  "containedTaxKinds",
] as const;

/**
 * CO2-Angaben und enthaltene Steuern einer Position: im Sheet nur als
 * Zusammenfassung mit "Bearbeiten", die Felder stehen auf einem SubSheet
 */
export const CostEntryCo2TaxesSection = ({
  form,
  index,
  showCo2Inputs,
  showContainedTaxesInput,
}: {
  form: UseFormReturn<CostEntryFormValues>;
  index: number;
  showCo2Inputs: boolean;
  showContainedTaxesInput: boolean;
}) => {
  // CO2-Angaben und Steuern stehen auf einem SubSheet. "Zurück" stellt den
  // Stand vom Öffnen wieder her
  const [co2TaxesOpen, setCo2TaxesOpen] = useState(false);
  const [co2TaxesSnapshot, setCo2TaxesSnapshot] = useState<
    CostEntryFormValues["items"][number] | null
  >(null);
  const openCo2Taxes = () => {
    setCo2TaxesSnapshot(structuredClone(form.getValues(`items.${index}`)));
    setCo2TaxesOpen(true);
  };
  const closeCo2Taxes = () => {
    if (co2TaxesSnapshot) {
      for (const field of CO2_TAX_FIELDS) {
        form.setValue(`items.${index}.${field}`, co2TaxesSnapshot[field], {
          shouldDirty: true,
        });
      }
    }
    setCo2TaxesOpen(false);
  };
  const co2Input = useWatch({
    control: form.control,
    name: `items.${index}.co2AmountInput`,
  });
  const taxesInput = useWatch({
    control: form.control,
    name: `items.${index}.containedTaxesInput`,
  });
  const co2TaxesTitle = showCo2Inputs
    ? t("ui.invoices.items.co2Taxes.title")
    : t("ui.invoices.items.co2Taxes.titleTaxes");
  const co2TaxesParts = [
    showCo2Inputs && co2Input?.trim()
      ? t("ui.invoices.items.co2Taxes.co2", { amount: co2Input.trim() })
      : null,
    showContainedTaxesInput && taxesInput?.trim()
      ? t("ui.invoices.items.co2Taxes.taxes", { amount: taxesInput.trim() })
      : null,
  ].filter((part): part is string => part !== null);
  const co2TaxesSummary =
    co2TaxesParts.length > 0
      ? co2TaxesParts.join(t("ui.common.separators.comma"))
      : t("ui.invoices.items.co2Taxes.empty");

  // Hinweise zu den Berechnungsgrundlagen. Beide sperren das Speichern nicht.
  const [co2AmountInput, co2CostInput, co2EnergyInput, co2EmissionFactorInput] =
    useWatch({
      control: form.control,
      name: [
        `items.${index}.co2AmountInput`,
        `items.${index}.co2CostInput`,
        `items.${index}.co2EnergyInput`,
        `items.${index}.co2EmissionFactorInput`,
      ],
    });
  const co2AmountKg = parseOptionalDecimal(co2AmountInput);
  const co2EnergyKwh = parseOptionalDecimal(co2EnergyInput);
  const co2EmissionFactor = parseOptionalDecimal(co2EmissionFactorInput);
  // Sobald eine der vier Angaben eingetragen ist, gehören alle vier dazu.
  const co2Inputs = [
    co2AmountKg,
    parseOptionalDecimal(co2CostInput),
    co2EnergyKwh,
    co2EmissionFactor,
  ];
  const co2BasisMissing =
    co2Inputs.some((value) => value !== null) &&
    co2Inputs.some((value) => value === null);
  const co2MismatchKg =
    co2AmountKg !== null && co2EnergyKwh !== null && co2EmissionFactor !== null
      ? co2BasisMismatchKg(co2AmountKg * 1000, co2EnergyKwh, co2EmissionFactor)
      : null;

  return (
    <>
      <SubSheetRow
        label={co2TaxesTitle}
        value={co2TaxesSummary}
        actionLabel={t("ui.common.action.edit")}
        onOpen={openCo2Taxes}
      />
      <SubSheet
        open={co2TaxesOpen}
        title={co2TaxesTitle}
        description={t("ui.invoices.items.co2Taxes.intro")}
        onBack={closeCo2Taxes}
        onApply={() => setCo2TaxesOpen(false)}
      >
        <FieldGroup>
          {showCo2Inputs ? (
            <>
              <TextInput
                control={form.control}
                name={`items.${index}.co2AmountInput`}
                label={t("ui.costs.entryFields.co2Amount")}
                optional={true}
                inputMode="decimal"
                placeholder={t("ui.common.placeholders.quantity")}
                suffix="kg"
              />
              <TextInput
                control={form.control}
                name={`items.${index}.co2CostInput`}
                label={t("ui.costs.entryFields.co2Cost")}
                labelHelp={t("ui.costs.entryFields.co2CostDescription")}
                optional={true}
                inputMode="decimal"
                placeholder={t("ui.common.placeholders.amount")}
                suffix="€"
              />
              <TextInput
                control={form.control}
                name={`items.${index}.co2EnergyInput`}
                label={t("ui.costs.entryFields.co2Energy")}
                optional={true}
                inputMode="decimal"
                placeholder={t("ui.common.placeholders.quantity")}
                suffix="kWh"
              />
              <TextInput
                control={form.control}
                name={`items.${index}.co2EmissionFactorInput`}
                label={t("ui.costs.entryFields.co2EmissionFactor")}
                labelHelp={t(
                  "ui.costs.entryFields.co2EmissionFactorDescription",
                )}
                optional={true}
                inputMode="decimal"
                suffix={t("ui.costs.entryFields.co2EmissionFactorUnit")}
              />
              {co2BasisMissing ? (
                <div>
                  <Alert variant="warning">
                    <AlertDescription>
                      {t("ui.costs.entryFields.co2BasisMissingHint")}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : null}
              {co2MismatchKg !== null && co2AmountKg !== null ? (
                <div>
                  <Alert variant="warning">
                    <AlertDescription>
                      {t("ui.costs.entryFields.co2BasisMismatchHint", {
                        computed: formatNumberLoose(co2MismatchKg, 0),
                        entered: formatNumberLoose(co2AmountKg, 0),
                      })}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : null}
            </>
          ) : null}
          {showContainedTaxesInput ? (
            <>
              <div>
                <TextInput
                  control={form.control}
                  name={`items.${index}.containedTaxesInput`}
                  label={t("ui.costs.entryFields.containedTaxes")}
                  labelHelp={t(
                    "ui.costs.entryFields.containedTaxesDescription",
                  )}
                  optional={true}
                  inputMode="decimal"
                  placeholder={t("ui.common.placeholders.amount")}
                  suffix="€"
                />
              </div>
              <div>
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
      </SubSheet>
    </>
  );
};
