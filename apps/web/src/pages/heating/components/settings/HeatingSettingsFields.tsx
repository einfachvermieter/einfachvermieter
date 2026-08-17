import {
  type HeatingFormValues,
  HOT_WATER_METER_NONE,
  heatingFuelTypes,
  heatingProrationMethods,
  heatingTypes,
  isCo2SplitInapplicableFuel,
} from "@einfachvermieter/shared";
import { RiCalendarLine, RiFireLine, RiPercentLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useId } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Disclose } from "@/components/common/Disclose";
import { SectionCard } from "@/components/common/SectionCard";
import { SplitBar } from "@/components/common/SplitBar";
import { MonthInput } from "@/components/form/MonthInput";
import { SelectInput } from "@/components/form/SelectInput";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { HelpHint } from "@/components/help/HelpHint";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/Field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { gradients } from "../../../../lib/domainVisuals";
import { t } from "../../../../lib/i18n";
import type { Meter } from "../../../../lib/meters";
import { ExternalBillingInfoToggle } from "./ExternalBillingInfoToggle";
import { HeatingProrationChart } from "./HeatingProrationChart";

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
  hotWaterMeterCandidates,
}: {
  form: UseFormReturn<HeatingFormValues>;
  hotWaterMeterCandidates: Meter[];
}) => {
  const billingTypeFieldId = useId();
  const mode = form.watch("mode");
  const consumptionMethod = form.watch("consumptionMethod");
  const heatingType = form.watch("heatingType");
  const prorationMethod = form.watch("prorationMethod");
  const buildingId = form.watch("buildingId");
  const fuelType = form.watch("fuelType");
  const co2CostShareEnabled = form.watch("co2CostShareEnabled");
  const currentBillingType = toBillingType({ mode, consumptionMethod });

  // Warnung: CO2-Aufteilung eingeschaltet, obwohl der Energieträger
  // keinem CO2-Preis nach CO2KostAufG unterliegt (Biomasse/Strom).
  const co2FuelMismatch =
    co2CostShareEnabled && isCo2SplitInapplicableFuel(fuelType);

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
  const basePercent = Number.parseInt(form.watch("baseSharePercent"), 10);

  return (
    <div className="space-y-5">
      <SectionCard
        icon={RiCalendarLine}
        iconBackground={gradients.heating}
        title={t("ui.heating.detail.validitySection")}
        description={t("ui.heating.detail.validityDescription")}
      >
        <FieldGroup className="gap-4">
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
      </SectionCard>

      <SectionCard
        icon={RiPercentLine}
        iconBackground={gradients.bank}
        title={t("ui.heating.cards.billing")}
        description={t("ui.heating.detail.billingDescription")}
      >
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
              </div>
              {Number.isFinite(basePercent) ? (
                <SplitBar
                  aPercent={basePercent}
                  aLabel={t("ui.heating.detail.splitBaseLegend", {
                    percent: basePercent,
                  })}
                  bLabel={t("ui.heating.detail.splitConsumptionLegend", {
                    percent: 100 - basePercent,
                  })}
                />
              ) : null}
              <SwitchInput
                control={form.control}
                name="mandatorySeventyPercent"
                label={t("ui.heating.fields.mandatorySeventyPercent")}
                description={t(
                  "ui.heating.fields.mandatorySeventyPercentDescription",
                )}
              />
            </>
          )}
          <SelectInput
            control={form.control}
            name="prorationMethod"
            label={t("ui.heating.fields.prorationMethod")}
            labelHelp={
              mode === "external"
                ? t("ui.heating.fields.prorationMethodDescriptionExternal")
                : t("ui.heating.fields.prorationMethodDescription")
            }
            options={prorationMethodOptions}
            triggerClassName="max-w-md"
          />
          <HeatingProrationChart method={prorationMethod} />
          <ExternalBillingInfoToggle form={form} mode={mode} />
        </FieldGroup>
      </SectionCard>

      {mode === "external" ? null : (
        <SectionCard
          icon={RiFireLine}
          iconBackground={gradients.heating}
          title={t("ui.heating.detail.installationSection")}
          description={t("ui.heating.detail.installationDescription")}
        >
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
            {fuelType === "district_heat" ? (
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  control={form.control}
                  name="districtHeatEmissionsKgPerYear"
                  label={t("ui.heating.fields.districtHeatEmissionsKgPerYear")}
                  labelHelp={t(
                    "ui.heating.fields.districtHeatEmissionsKgPerYearDescription",
                  )}
                  inputMode="decimal"
                  placeholder={t(
                    "ui.heating.fields.districtHeatEmissionsKgPerYearPlaceholder",
                  )}
                  suffix="kg"
                  optional={true}
                />
                <TextInput
                  control={form.control}
                  name="districtHeatPrimaryEnergyFactor"
                  label={t("ui.heating.fields.districtHeatPrimaryEnergyFactor")}
                  labelHelp={t(
                    "ui.heating.fields.districtHeatPrimaryEnergyFactorDescription",
                  )}
                  inputMode="decimal"
                  placeholder={t(
                    "ui.heating.fields.districtHeatPrimaryEnergyFactorPlaceholder",
                  )}
                  optional={true}
                />
              </div>
            ) : null}
            {isCentralWithHotWater ? (
              <Disclose
                label={t("ui.heating.detail.hotWaterDisclose")}
                defaultOpen={true}
              >
                <FieldGroup className="gap-4">
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
                  {fuelType === "gas" ? (
                    <SwitchInput
                      control={form.control}
                      name="gasBillingByCalorificValue"
                      label={t("ui.heating.fields.gasBillingByCalorificValue")}
                      description={t(
                        "ui.heating.fields.gasBillingByCalorificValueDescription",
                      )}
                    />
                  ) : null}
                  {fuelType === "heat_pump" ? (
                    <SwitchInput
                      control={form.control}
                      name="heatPumpMonovalent"
                      label={t("ui.heating.fields.heatPumpMonovalent")}
                      description={t(
                        "ui.heating.fields.heatPumpMonovalentDescription",
                      )}
                    />
                  ) : null}
                  {fuelType === "district_heat" ? (
                    <Alert variant="info">
                      <AlertDescription>
                        {t("ui.heating.fields.districtHeatCorrectionNote")}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </FieldGroup>
              </Disclose>
            ) : null}
            <div className="border-t border-border pt-4">
              <SwitchInput
                control={form.control}
                name="co2CostShareEnabled"
                label={t("ui.heating.fields.co2CostShareEnabled")}
                description={t(
                  "ui.heating.fields.co2CostShareEnabledDescription",
                )}
                labelHelp={t("ui.heating.fields.co2CostShareEnabledHelp")}
              />
            </div>
            {co2FuelMismatch ? (
              <Alert variant="warning">
                <AlertDescription>
                  {t("ui.heating.fields.co2FuelMismatchWarning", {
                    fuel: t(`ui.heating.fuelTypes.${fuelType}`),
                  })}
                </AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </SectionCard>
      )}
    </div>
  );
};
