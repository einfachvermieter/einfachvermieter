import type { HeatingSettings } from "@einfachvermieter/shared";
import { RiFireLine, RiPencilLine } from "@remixicon/react";
import type { ResultRow } from "@/components/common/ResultRows";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
import { t } from "../../../lib/i18n";
import type { Meter } from "../../../lib/meters";

/**
 * View-Card der Heizungsanlage: Heizungsart, Brennstoff, Warmwasser und
 * die CO2-Kostenaufteilung
 */
export const HeatingInstallationCard = ({
  version,
  hotWaterMeter,
  onEdit,
}: {
  version: HeatingSettings;
  hotWaterMeter: Meter | undefined;
  onEdit: () => void;
}) => {
  const yesNo = (value: boolean) => (value ? t("common.yes") : t("common.no"));

  const rows: ResultRow[] = [
    {
      label: t("ui.heating.fields.heatingType"),
      value: t(`ui.heating.heatingTypes.${version.heatingType}`),
    },
    {
      label: t("ui.heating.fields.fuelType"),
      value: t(`ui.heating.fuelTypes.${version.fuelType}`),
    },
  ];

  if (version.heatingType === "central_with_hot_water") {
    rows.push(
      {
        label: t("ui.heating.fields.hotWaterMeter"),
        value: hotWaterMeter
          ? hotWaterMeter.label
          : t("ui.heating.fields.hotWaterMeterNone"),
      },
      {
        label: t("ui.heating.fields.hotWaterSupplyTemperature"),
        value: t("ui.common.measures.celsius", {
          value: version.hotWaterSupplyTemperatureCelsius,
        }),
      },
    );

    if (version.fuelType === "gas") {
      rows.push({
        label: t("ui.heating.fields.gasBillingByCalorificValue"),
        value: yesNo(version.gasBillingByCalorificValue),
      });
    }
    if (version.fuelType === "heat_pump") {
      rows.push({
        label: t("ui.heating.fields.heatPumpMonovalent"),
        value: yesNo(version.heatPumpMonovalent),
      });
    }
  }

  rows.push({
    label: t("ui.heating.fields.co2CostShareEnabled"),
    value: yesNo(version.co2CostShareEnabled),
  });

  return (
    <SectionCard
      icon={RiFireLine}
      title={t("ui.heating.installation.title")}
      action={
        <Button type="button" variant="addLink" size="text" onClick={onEdit}>
          <RiPencilLine />
          {t("ui.common.action.edit")}
        </Button>
      }
    >
      <ResultRows rows={rows} />
      {version.heatingType === "central_with_hot_water" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("ui.heating.fields.periodValuesHintTotalHeat")}
        </p>
      ) : null}
      {version.fuelType === "district_heat" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("ui.heating.fields.periodValuesHintDistrictHeat")}
        </p>
      ) : null}
    </SectionCard>
  );
};
