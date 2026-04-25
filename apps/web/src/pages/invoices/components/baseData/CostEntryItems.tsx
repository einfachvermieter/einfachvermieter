import { RiAddLine, RiDeleteBin5Line } from "@remixicon/react";
import { useEffect, useId } from "react";
import {
  Controller,
  type UseFormReturn,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/Field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import type { CostType } from "../../../../lib/costs";
import { t, translateKey } from "../../../../lib/i18n";
import type { Unit } from "../../../../lib/units";
import {
  type CostEntryFormValues,
  emptyItem,
  type PriceMode,
  unitPriceDisplayConfig,
} from "./costEntryForm.schema";

export const CostEntryItems = ({
  form,
  costTypes,
  units,
}: {
  form: UseFormReturn<CostEntryFormValues>;
  costTypes: CostType[];
  units: Unit[];
}) => {
  const itemsArray = useFieldArray({ control: form.control, name: "items" });
  const rootError = translateKey(form.formState.errors.items?.message);
  const defaultCostTypeId = costTypes[0]?.id ?? "";

  const options = costTypes.map((costType) => ({
    value: costType.id,
    label: costType.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ui.invoices.items.title")}</CardTitle>
        <CardDescription>{t("ui.invoices.items.description")}</CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghostGreen"
            size="sm"
            onClick={() => itemsArray.append(emptyItem(defaultCostTypeId))}
          >
            <RiAddLine />
            {t("ui.invoices.items.add")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {itemsArray.fields.length === 0 ? (
          <Alert variant="info">
            <AlertDescription>{t("ui.invoices.items.empty")}</AlertDescription>
          </Alert>
        ) : null}
        {itemsArray.fields.map((field, index) => (
          <CostEntryItemFields
            key={field.id}
            form={form}
            index={index}
            options={options}
            costTypes={costTypes}
            units={units}
            onRemove={() => itemsArray.remove(index)}
          />
        ))}
        {rootError ? (
          <p className="text-sm text-destructive">{rootError}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt am Markup
const CostEntryItemFields = ({
  form,
  index,
  options,
  costTypes,
  units,
  onRemove,
}: {
  form: UseFormReturn<CostEntryFormValues>;
  index: number;
  options: Array<{ value: string; label: string }>;
  costTypes: CostType[];
  units: Unit[];
  onRemove: () => void;
}) => {
  const selectedCostTypeId = useWatch({
    control: form.control,
    name: `items.${index}.costTypeId`,
  });
  const priceMode = useWatch({
    control: form.control,
    name: `items.${index}.priceMode`,
  });
  const selectedCostType = costTypes.find((c) => c.id === selectedCostTypeId);
  const allocationKey = selectedCostType?.defaultAllocationKey ?? null;
  const isHeating = selectedCostType?.category === "heating";
  const displayConfig = unitPriceDisplayConfig(
    selectedCostType?.category ?? null,
    allocationKey,
  );
  const unitSuffix = displayConfig?.suffix ?? null;
  // Bei Pauschal-Kostenarten (`fixed`) ohne sinnvolle Einheit wird der
  // Radio ausgeblendet und der Modus auf "fixed" gepinnt. Verbrauchs-
  // Kostenarten und Heizkostenarten starten in "Verbrauchspreis",
  // andere Bezugs-Allocations in "Fixpreis".
  const showPriceModeToggle = unitSuffix !== null;
  const defaultPriceMode: PriceMode =
    allocationKey === "per_consumption_m3" ||
    allocationKey === "per_consumption_kwh" ||
    isHeating
      ? "per_unit"
      : "fixed";
  useEffect(() => {
    if (!showPriceModeToggle && priceMode !== "fixed") {
      form.setValue(`items.${index}.priceMode`, "fixed", { shouldDirty: true });
    }
  }, [showPriceModeToggle, priceMode, form, index]);
  const showUnitPriceInput =
    showPriceModeToggle && priceMode === "per_unit" && unitSuffix !== null;
  const showLaborCostsInput = Boolean(selectedCostType?.laborCostCategory);
  const showCo2Inputs = selectedCostType?.co2Tracked === true;
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
  // Submit (Server lehnt unitId bei nicht-fixed ab).
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
  const fixedId = useId();
  const perUnitId = useId();

  return (
    <div className="rounded-md border border-border p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">
          {t("ui.invoices.items.positionLabel", { index: index + 1 })}
        </span>
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              type="button"
              variant="ghostRed"
              size="icon-sm"
              onClick={onRemove}
              aria-label={t("ui.invoices.items.remove")}
            >
              <RiDeleteBin5Line />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("ui.invoices.items.remove")}</TooltipContent>
        </Tooltip>
      </div>
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SelectInput
            control={form.control}
            name={`items.${index}.costTypeId`}
            label={t("ui.costs.entryFields.costType")}
            triggerClassName="w-full sm:max-w-md"
            options={options}
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
              triggerClassName="w-full sm:max-w-md"
              options={unitOptions}
            />
          </div>
        ) : null}
        <TextInput
          control={form.control}
          name={`items.${index}.amountInput`}
          label={t("ui.costs.entryFields.amountGross")}
          inputMode="decimal"
          placeholder="0,00"
          suffix="€"
          inputClassName="max-w-xs"
        />
        <div className="hidden sm:block" />
        <DateInput
          control={form.control}
          name={`items.${index}.periodStart`}
          label={t("ui.costs.entryFields.periodFrom")}
          inputClassName="max-w-xs"
        />
        <DateInput
          control={form.control}
          name={`items.${index}.periodEnd`}
          label={t("ui.costs.entryFields.periodTo")}
          inputClassName="max-w-xs"
        />
        {showPriceModeToggle ? (
          <div className="space-y-3 sm:col-span-2">
            <Controller
              control={form.control}
              name={`items.${index}.priceMode`}
              defaultValue={defaultPriceMode}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  columns={2}
                >
                  <FieldLabel htmlFor={fixedId}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>
                          {t("ui.costs.entryFields.priceModeFixed")}
                        </FieldTitle>
                        <FieldDescription>
                          {t("ui.costs.entryFields.priceModeFixedDescription")}
                        </FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value="fixed" id={fixedId} />
                    </Field>
                  </FieldLabel>
                  <FieldLabel htmlFor={perUnitId}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>
                          {t("ui.costs.entryFields.priceModePerUnit")}
                        </FieldTitle>
                        <FieldDescription>
                          {t(
                            "ui.costs.entryFields.priceModePerUnitDescription",
                          )}
                        </FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value="per_unit" id={perUnitId} />
                    </Field>
                  </FieldLabel>
                </RadioGroup>
              )}
            />
            {showUnitPriceInput && unitSuffix ? (
              <TextInput
                control={form.control}
                name={`items.${index}.unitPriceInput`}
                label={t("ui.costs.entryFields.unitPrice")}
                description={t("ui.costs.entryFields.unitPriceDescription")}
                inputMode="decimal"
                placeholder="0,0000"
                suffix={unitSuffix}
                inputClassName="max-w-xs"
              />
            ) : null}
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
              inputClassName="max-w-xs"
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
              placeholder="0,000"
              suffix="kg"
              inputClassName="max-w-xs"
            />
            <TextInput
              control={form.control}
              name={`items.${index}.co2CostInput`}
              label={t("ui.costs.entryFields.co2Cost")}
              description={t("ui.costs.entryFields.co2CostDescription")}
              optional={true}
              inputMode="decimal"
              placeholder="0,00"
              suffix="€"
              inputClassName="max-w-xs"
            />
          </>
        ) : null}
      </FieldGroup>
    </div>
  );
};
