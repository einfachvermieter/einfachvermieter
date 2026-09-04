import { formatDate, type HeatingSettings } from "@einfachvermieter/shared";
import { RiPencilLine, RiPercentLine } from "@remixicon/react";
import type { ResultRow } from "@/components/common/ResultRows";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { SplitBar } from "@/components/common/SplitBar";
import { Button } from "@/components/ui/Button";
import { t } from "../../../lib/i18n";
import { toBillingType } from "../billingType";

/**
 * View-Card der Abrechnung: Gültigkeit, Art der Abrechnung, Anteile und
 * die Aufteilung bei Mieter- oder Leerstandswechsel
 */
export const HeatingBillingCard = ({
  version,
  onEdit,
}: {
  version: HeatingSettings;
  onEdit: () => void;
}) => {
  const isInternal = version.mode === "internal";
  const yesNo = (value: boolean) => (value ? t("common.yes") : t("common.no"));

  const rows: ResultRow[] = [
    {
      label: t("ui.heating.fields.validFrom"),
      value: formatDate(version.validFrom),
    },
    {
      label: t("ui.heating.fields.validTo"),
      value: version.validTo
        ? formatDate(version.validTo)
        : t("ui.heating.versions.openEnd"),
    },
    {
      label: t("ui.heating.fields.billingType"),
      value: t(`ui.heating.billingTypes.${toBillingType(version)}`),
    },
  ];

  if (isInternal) {
    rows.splice(3, 0, {
      label: t("ui.heating.versions.columns.split"),
      value: t("ui.heating.summary.split", {
        base: version.baseSharePercent,
        consumption: version.consumptionSharePercent,
      }),
    });
    rows.push({
      label: t("ui.heating.fields.mandatorySeventyPercent"),
      value: yesNo(version.mandatorySeventyPercent),
    });
  } else {
    rows.push({
      label: t("ui.heating.fields.includeBillingInfo"),
      value: yesNo(version.includeBillingInfo),
    });
  }

  return (
    <SectionCard
      icon={RiPercentLine}
      title={t("ui.heating.cards.billing")}
      action={
        <Button type="button" variant="addLink" size="text" onClick={onEdit}>
          <RiPencilLine />
          {t("ui.common.action.edit")}
        </Button>
      }
    >
      <ResultRows rows={rows} />

      {isInternal ? (
        <div className="mt-4">
          <SplitBar
            aPercent={version.baseSharePercent}
            aLabel={t("ui.heating.detail.splitBaseLegend", {
              percent: version.baseSharePercent,
            })}
            bLabel={t("ui.heating.detail.splitConsumptionLegend", {
              percent: version.consumptionSharePercent,
            })}
          />
        </div>
      ) : null}
    </SectionCard>
  );
};
