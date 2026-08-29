import {
  type HeatingFormValues,
  HOT_WATER_METER_NONE,
  heatingFuelTypes,
  heatingTypes,
  isCo2SplitInapplicableFuel,
} from "@einfachvermieter/shared";
import { Link } from "@tanstack/react-router";
import type { UseFormReturn } from "react-hook-form";
import { Disclose } from "@/components/common/Disclose";
import { SelectInput } from "@/components/form/SelectInput";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import type { Meter } from "../../../../lib/meters";

/**
 * Felder der Heizungsanlage: Heizungsart, Brennstoff, Warmwasser-Details
 * und die CO2-Kostenaufteilung
 */
export const HeatingInstallationFields = ({
  form,
  hotWaterMeterCandidates,
}: {
  form: UseFormReturn<HeatingFormValues>;
  hotWaterMeterCandidates: Meter[];
}) => {
  const heatingType = form.watch("heatingType");
  const buildingId = form.watch("buildingId");
  const fuelType = form.watch("fuelType");
  const co2CostShareEnabled = form.watch("co2CostShareEnabled");

  // Warnung: CO2-Aufteilung eingeschaltet, obwohl der Energieträger
  // keinem CO2-Preis nach CO2KostAufG unterliegt (Biomasse/Strom).
  const co2FuelMismatch =
    co2CostShareEnabled && isCo2SplitInapplicableFuel(fuelType);

  const heatingTypeOptions = heatingTypes.map((value) => ({
    value,
    label: t(`ui.heating.heatingTypes.${value}`),
  }));

  const fuelTypeOptions = heatingFuelTypes.map((value) => ({
    value,
    label: t(`ui.heating.fuelTypes.${value}`),
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

  return (
    <FieldGroup className="gap-4">
      <SelectInput
        control={form.control}
        name="heatingType"
        label={t("ui.heating.fields.heatingType")}
        labelHelp={t("ui.heating.fields.heatingTypeDescription")}
        options={heatingTypeOptions}
      />
      <SelectInput
        control={form.control}
        name="fuelType"
        label={t("ui.heating.fields.fuelType")}
        labelHelp={t("ui.heating.fields.fuelTypeDescription")}
        options={fuelTypeOptions}
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
      {heatingType === "central_with_hot_water" ? (
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
                    to="/zaehler"
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
                labelHelp={t("ui.heating.fields.hotWaterMeterDescription")}
                options={hotWaterMeterOptions}
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
            />
            <TextInput
              control={form.control}
              name="totalHeatEnergyKwh"
              label={t("ui.heating.fields.totalHeatEnergyKwh")}
              labelHelp={t("ui.heating.fields.totalHeatEnergyKwhDescription")}
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              suffix="kWh"
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
          description={t("ui.heating.fields.co2CostShareEnabledDescription")}
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
  );
};
