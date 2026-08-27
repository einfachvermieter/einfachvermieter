import { formatDate, formatNumber } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { MiniKpiRow } from "../../components/common/MiniKpiRow";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import {
  measurementUnitLabel,
  meterQueryOptions,
  meterReadByLabel,
  meterRoleLabel,
  meterTypeLabel,
  type Reading,
  readingsQueryOptions,
} from "../../lib/meters";
import { unitsQueryOptions } from "../../lib/units";
import { MeterDetailHeader } from "./MeterDetailHeader";

const SKELETON_KEYS = ["last", "consumption"];

/**
 * Letzter Stand und Jahresverbrauch. Bezugsjahr ist das Jahr der jüngsten
 * Ablesung, nicht das Kalenderjahr; Basiswert ist der jüngste Stand am oder
 * vor dem Jahresbeginn ("<=" nimmt eine Ablesung exakt zum 01.01. mit).
 */
const summarizeReadings = (readings: Reading[] | undefined) => {
  const sorted = [...(readings ?? [])].sort((a, b) =>
    b.readingDate.localeCompare(a.readingDate),
  );
  const latest = sorted[0] ?? null;
  const year = latest
    ? Number(latest.readingDate.slice(0, 4))
    : new Date().getFullYear();
  const baseline =
    sorted.find((entry) => entry.readingDate <= `${year}-01-01`) ?? null;

  return {
    latest,
    year,
    baseline,
    consumption: latest && baseline ? latest.value - baseline.value : null,
  };
};

/**
 * Gemeinsames Gerüst der Zähler-Detailseiten: Kopf mit Status, Bereichs-
 * Pills und die Kennzahlen (letzter Stand, Jahresverbrauch).
 */
export const MeterDetailLayout = ({
  meterId,
  active,
  action,
  className,
  children,
}: {
  meterId: string;
  active: "stammdaten" | "zaehlerstaende";

  /**
   * Aktionen rechts im Kopf (Mehr-Menü bzw. "Zählerstand erfassen")
   */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) => {
  const { data: meter } = useQuery(meterQueryOptions(meterId));
  const { data: readings } = useQuery(readingsQueryOptions(meterId));
  const { data: units } = useQuery(unitsQueryOptions);

  const unit = meter?.unitId
    ? units?.find((entry) => entry.id === meter.unitId)
    : undefined;

  const { latest, year, baseline, consumption } = summarizeReadings(readings);

  const dash = t("ui.common.emptyValue");
  const unitLabel = meter ? measurementUnitLabel(meter.measurementUnit) : "";

  const subItems: ReactNode[] = [];
  if (meter) {
    subItems.push(<span>{meterTypeLabel(meter.type)}</span>);
    subItems.push(<span>{meterRoleLabel(meter.role)}</span>);
  }
  if (unit) {
    subItems.push(
      <Link
        to="/wohnungen/$unitId"
        params={{ unitId: unit.id }}
        className="underline-offset-3 transition-colors hover:text-azur-700 hover:underline"
      >
        {unit.name}
      </Link>,
    );
  }

  return (
    <div className={className ? `max-w-225 ${className}` : "max-w-225"}>
      {meter ? (
        <PageHeader
          tile={<PageHeaderIcon icon={domainVisuals.meters.icon} />}
          title={meter.label}
          titleExtra={
            <Badge variant={meter.isActive ? "ok" : "neutral"}>
              {meter.isActive
                ? t("ui.meters.detail.statusActive")
                : t("ui.meters.detail.statusInactive")}
            </Badge>
          }
          sub={
            <span>
              {subItems.map((item, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: statische Liste
                <Fragment key={index}>
                  {index > 0 ? t("ui.common.separators.bullet") : null}
                  {item}
                </Fragment>
              ))}
            </span>
          }
          action={action}
        />
      ) : (
        <PageHeader
          tile={<PageHeaderIcon icon={domainVisuals.meters.icon} />}
          title=""
          loading={true}
        />
      )}

      <div className="flex flex-col gap-2">
        <MeterDetailHeader meterId={meterId} active={active} />

        <div className="space-y-5">
          {meter ? (
            <MiniKpiRow
              columns={2}
              items={[
                {
                  label: t("ui.meters.detail.statLastReading"),
                  value: latest
                    ? `${formatNumber(latest.value)} ${unitLabel}`
                    : dash,
                  hint: latest
                    ? t("ui.meters.detail.lastReadingHint", {
                        date: formatDate(latest.readingDate),
                        source: meterReadByLabel(latest.readBy),
                      })
                    : t("ui.meters.noReadings"),
                },
                {
                  label: t("ui.meters.detail.statConsumption", { year }),
                  value:
                    consumption === null ? (
                      dash
                    ) : (
                      <span
                        className={
                          consumption < 0 ? "text-himbeere-500" : undefined
                        }
                      >
                        {`${formatNumber(consumption)} ${unitLabel}`}
                      </span>
                    ),
                  hint:
                    latest && baseline
                      ? t("ui.common.periodLabel", {
                          start: formatDate(baseline.readingDate),
                          end: formatDate(latest.readingDate),
                        })
                      : undefined,
                },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {SKELETON_KEYS.map((key) => (
                <Skeleton key={key} className="h-22 rounded-lg" />
              ))}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};
