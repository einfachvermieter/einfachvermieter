import { formatNumber } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { HeroBand } from "../../components/common/HeroBand";
import { IconTile } from "../../components/common/IconTile";
import { meterTypeVisual } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import {
  measurementUnitLabel,
  meterQueryOptions,
  meterRoleLabel,
  meterTypeLabel,
  readingsQueryOptions,
} from "../../lib/meters";

/**
 * Hero-Band eines Zählers (Stammdaten- und Zählerstände-Tab)
 */
export const MeterHero = ({
  meterId,
  eyebrow,
}: {
  meterId: string;
  eyebrow: string;
}) => {
  const { data: meter } = useQuery(meterQueryOptions(meterId));
  const { data: readings } = useQuery(readingsQueryOptions(meterId));

  if (!meter) {
    return null;
  }

  const unitLabel = measurementUnitLabel(meter.measurementUnit);
  const dash = t("ui.common.emptyValue");
  const sorted = [...(readings ?? [])].sort((a, b) =>
    b.readingDate.localeCompare(a.readingDate),
  );
  const latest = sorted[0] ?? null;
  const year = new Date().getFullYear();
  const baseline = sorted.find((r) => r.readingDate < `${year}-01-01`) ?? null;
  const consumption = latest && baseline ? latest.value - baseline.value : null;

  const lastReadingText = latest
    ? `${formatNumber(latest.value)} ${unitLabel}`
    : dash;
  const consumptionText =
    consumption !== null ? `${formatNumber(consumption)} ${unitLabel}` : dash;

  return (
    <HeroBand
      tile={
        <IconTile
          icon={meterTypeVisual(meter.type).icon}
          size={64}
          background={meterTypeVisual(meter.type).gradient}
        />
      }
      eyebrow={eyebrow}
      title={meter.label}
      meta={[meterTypeLabel(meter.type), meterRoleLabel(meter.role)].join(
        t("ui.common.separators.bullet"),
      )}
      stats={[
        {
          label: t("ui.meters.detail.statLastReading"),
          value: lastReadingText,
        },
        {
          label: t("ui.meters.detail.statConsumption", { year }),
          value: consumptionText,
        },
        {
          label: t("ui.meters.detail.statStatus"),
          value: meter.isActive
            ? t("ui.meters.detail.statusActive")
            : t("ui.meters.detail.statusInactive"),
        },
      ]}
    />
  );
};
