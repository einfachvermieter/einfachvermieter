import { formatNumber } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { IconTile } from "../../components/common/IconTile";
import { PageHeader } from "../../components/common/PageHeader";
import {
  domainVisuals,
  gradients,
  meterTypeVisual,
} from "../../lib/domainVisuals";
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
export const MeterHero = ({ meterId }: { meterId: string }) => {
  const { data: meter } = useQuery(meterQueryOptions(meterId));
  const { data: readings } = useQuery(readingsQueryOptions(meterId));

  if (!meter) {
    return (
      <PageHeader
        tile={
          <IconTile
            icon={domainVisuals.meters.icon}
            size={44}
            background={gradients.water}
          />
        }
        title=""
        loading={true}
        statsSkeleton={3}
      />
    );
  }

  const unitLabel = measurementUnitLabel(meter.measurementUnit);
  const dash = t("ui.common.emptyValue");
  const sorted = [...(readings ?? [])].sort((a, b) =>
    b.readingDate.localeCompare(a.readingDate),
  );
  const latest = sorted[0] ?? null;

  // Bezugsjahr ist das Jahr der jüngsten Ablesung, nicht das Kalenderjahr
  const year = latest
    ? Number(latest.readingDate.slice(0, 4))
    : new Date().getFullYear();

  // Basiswert des Jahres: jüngster Stand am oder vor dem Jahresbeginn. Das
  // "<=" nimmt eine Ablesung exakt zum 01.01. als Anfangsstand mit
  const baseline = sorted.find((r) => r.readingDate <= `${year}-01-01`) ?? null;

  const consumption = latest && baseline ? latest.value - baseline.value : null;

  const lastReadingText = latest
    ? `${formatNumber(latest.value)} ${unitLabel}`
    : dash;
  const consumptionText =
    consumption !== null ? `${formatNumber(consumption)} ${unitLabel}` : dash;

  return (
    <PageHeader
      tile={
        <IconTile
          icon={meterTypeVisual(meter.type).icon}
          size={44}
          background={meterTypeVisual(meter.type).gradient}
        />
      }
      title={meter.label}
      sub={[meterTypeLabel(meter.type), meterRoleLabel(meter.role)].join(
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
