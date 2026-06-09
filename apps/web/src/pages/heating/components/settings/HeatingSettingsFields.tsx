import {
  type HeatingFormValues,
  HOT_WATER_METER_NONE,
  heatingFuelTypes,
  heatingProrationMethods,
  heatingTypes,
} from "@einfachvermieter/shared";
import { Link } from "@tanstack/react-router";
import { useEffect, useId } from "react";
import type { UseFormReturn } from "react-hook-form";
import { CheckboxInput } from "@/components/form/CheckboxInput";
import { MonthInput } from "@/components/form/MonthInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { HelpHint } from "@/components/help/HelpHint";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/Field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { Building } from "../../../../lib/buildings";
import { t } from "../../../../lib/i18n";
import type { Meter } from "../../../../lib/meters";

/**
 * UI-Schlüssel für die kombinierte Auswahl Abrechnungsmodus + Verbrauchs-
 * erfassung. Wird beim Setzen in `mode` + `consumptionMethod` zerlegt;
 * persistiert wird weiterhin in den getrennten Feldern.
 */
const billingTypes = [
  "internal_heat_meter",
  "internal_heat_cost_allocator",
  "external",
] as const;
type BillingType = (typeof billingTypes)[number];

const toBillingType = (
  values: Pick<HeatingFormValues, "mode" | "consumptionMethod">,
): BillingType => {
  if (values.mode === "external") {
    return "external";
  }
  return values.consumptionMethod === "heat_cost_allocator"
    ? "internal_heat_cost_allocator"
    : "internal_heat_meter";
};

/**
 * Setzt das komplementäre Anteilsfeld (Grund-/Verbrauchsanteil, Summe = 100 %)
 * auf `100 − Wert`, sofern der eingegebene Wert eine valide Prozentzahl ist
 * und sich der Zielwert tatsächlich ändert.
 */
const syncComplementaryShare = (
  form: UseFormReturn<HeatingFormValues>,
  targetField: "baseSharePercent" | "consumptionSharePercent",
  rawValue: string | undefined,
): void => {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return;
  }

  const next = String(100 - parsed);
  if (form.getValues(targetField) !== next) {
    form.setValue(targetField, next);
  }
};

const applyBillingType = (
  form: UseFormReturn<HeatingFormValues>,
  next: BillingType,
) => {
  if (next === "external") {
    form.setValue("mode", "external");
    return;
  }

  form.setValue("mode", "internal");
  form.setValue(
    "consumptionMethod",
    next === "internal_heat_cost_allocator"
      ? "heat_cost_allocator"
      : "heat_meter",
  );
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt in den Feld-Sektionen (JSX).
export const HeatingSettingsFields = ({
  form,
  buildings,
  buildingFieldDisabled = false,
  hotWaterMeterCandidates,
}: {
  form: UseFormReturn<HeatingFormValues>;
  buildings: Building[];
  buildingFieldDisabled?: boolean;
  hotWaterMeterCandidates: Meter[];
}) => {
  const billingTypeFieldId = useId();
  const mode = form.watch("mode");
  const consumptionMethod = form.watch("consumptionMethod");
  const heatingType = form.watch("heatingType");
  const buildingId = form.watch("buildingId");
  const currentBillingType = toBillingType({ mode, consumptionMethod });

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type !== "change") {
        return;
      }
      if (name === "consumptionSharePercent") {
        syncComplementaryShare(
          form,
          "baseSharePercent",
          value.consumptionSharePercent,
        );
      } else if (name === "baseSharePercent") {
        syncComplementaryShare(
          form,
          "consumptionSharePercent",
          value.baseSharePercent,
        );
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const heatingTypeOptions = heatingTypes.map((value) => ({
    value,
    label: t(`ui.heating.heatingTypes.${value}`),
  }));

  const fuelTypeOptions = heatingFuelTypes.map((value) => ({
    value,
    label: t(`ui.heating.fuelTypes.${value}`),
  }));

  const prorationMethodOptions = heatingProrationMethods.map((value) => ({
    value,
    label: t(`ui.heating.prorationMethods.${value}`),
  }));

  const hotWaterMeterOptions = [
    {
      value: HOT_WATER_METER_NONE,
      label: t("ui.heating.fields.hotWaterMeterNone"),
    },
    ...hotWaterMeterCandidates.map((meter) => ({
      value: meter.id,
      label: meter.label,
    })),
  ];

  const isCentralWithHotWater = heatingType === "central_with_hot_water";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <FieldGroup className="gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <MonthInput
                control={form.control}
                name="validFrom"
                label={t("ui.heating.fields.validFrom")}
                description={t("ui.heating.fields.validFromDescription")}
                boundary="start"
              />
              <MonthInput
                control={form.control}
                name="validTo"
                label={t("ui.heating.fields.validTo")}
                description={t("ui.heating.fields.validToDescription")}
                boundary="end"
                optional={true}
              />
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("ui.heating.cards.billing")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor={billingTypeFieldId}>
                {t("ui.heating.fields.billingType")}
                <HelpHint>
                  {t("ui.heating.fields.billingTypeDescription")}
                </HelpHint>
              </FieldLabel>
              <Select
                value={currentBillingType}
                onValueChange={(value) =>
                  applyBillingType(form, value as BillingType)
                }
              >
                <SelectTrigger id={billingTypeFieldId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {billingTypes.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`ui.heating.billingTypes.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {mode === "external" ? null : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    control={form.control}
                    name="consumptionSharePercent"
                    label={t("ui.heating.fields.consumptionSharePercent")}
                    labelHelp={t("ui.heating.fields.splitDescription")}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    step="1"
                    suffix="%"
                  />
                  <TextInput
                    control={form.control}
                    name="baseSharePercent"
                    label={t("ui.heating.fields.baseSharePercent")}
                    labelHelp={t("ui.heating.fields.baseShareDescription")}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    step="1"
                    suffix="%"
                  />
                </div>
                <SelectInput
                  control={form.control}
                  name="prorationMethod"
                  label={t("ui.heating.fields.prorationMethod")}
                  labelHelp={t("ui.heating.fields.prorationMethodDescription")}
                  options={prorationMethodOptions}
                  triggerClassName="max-w-md"
                />
              </>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {mode === "external" ? null : (
        <Card>
          <CardHeader>
            <CardTitle>{t("ui.heating.installation.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4">
              <SelectInput
                control={form.control}
                name="heatingType"
                label={t("ui.heating.fields.heatingType")}
                labelHelp={t("ui.heating.fields.heatingTypeDescription")}
                options={heatingTypeOptions}
                triggerClassName="max-w-md"
              />
              <SelectInput
                control={form.control}
                name="fuelType"
                label={t("ui.heating.fields.fuelType")}
                labelHelp={t("ui.heating.fields.fuelTypeDescription")}
                options={fuelTypeOptions}
                triggerClassName="max-w-md"
              />
              {isCentralWithHotWater ? (
                <>
                  {hotWaterMeterCandidates.length === 0 ? (
                    <Alert variant="info">
                      <AlertDescription>
                        {t("ui.heating.fields.hotWaterMeterMissing")}{" "}
                        <Link
                          to="/zaehler/neu"
                          search={{
                            buildingId,
                            type: "water_hot",
                            unitId: undefined,
                          }}
                          className="font-medium underline underline-offset-2"
                        >
                          {t("ui.heating.fields.hotWaterMeterMissingLink")}
                        </Link>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <SelectInput
                      control={form.control}
                      name="hotWaterMeterId"
                      label={t("ui.heating.fields.hotWaterMeter")}
                      labelHelp={t(
                        "ui.heating.fields.hotWaterMeterDescription",
                      )}
                      options={hotWaterMeterOptions}
                      triggerClassName="max-w-md"
                    />
                  )}
                  <TextInput
                    control={form.control}
                    name="hotWaterSupplyTemperatureCelsius"
                    label={t("ui.heating.fields.hotWaterSupplyTemperature")}
                    labelHelp={t(
                      "ui.heating.fields.hotWaterSupplyTemperatureDescription",
                    )}
                    type="number"
                    inputMode="numeric"
                    min="20"
                    max="95"
                    step="1"
                    suffix="°C"
                    inputClassName="max-w-xs"
                  />
                  <TextInput
                    control={form.control}
                    name="totalHeatEnergyKwh"
                    label={t("ui.heating.fields.totalHeatEnergyKwh")}
                    labelHelp={t(
                      "ui.heating.fields.totalHeatEnergyKwhDescription",
                    )}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    suffix="kWh"
                    inputClassName="max-w-xs"
                  />
                </>
              ) : null}
              <CheckboxInput
                control={form.control}
                name="co2CostShareEnabled"
                label={t("ui.heating.fields.co2CostShareEnabled")}
              />
            </FieldGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
