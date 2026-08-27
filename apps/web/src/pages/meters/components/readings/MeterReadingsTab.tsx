import { formatDate } from "@einfachvermieter/shared";
import { RiListOrdered2, RiPencilLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { EmptyNote } from "@/components/common/EmptyNote";
import { SectionCard } from "@/components/common/SectionCard";
import { RowActionButton, RowActions } from "@/components/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { t } from "../../../../lib/i18n";
import {
  type MeasurementUnit,
  type MeterRole,
  measurementUnitLabel,
  meterReadByLabel,
  type Reading,
  readingsQueryOptions,
} from "../../../../lib/meters";
import { useDeleteResource } from "../../../../lib/useDeleteResource";
import { isInSettledPeriod, useSettledPeriods } from "./useSettledPeriods";

/**
 * Eine Zählerstands-Zeile inkl. berechnetem Verbrauch
 */
const skeletonRowKeys = Array.from(
  { length: 5 },
  (_, index) => `reading-skeleton-${index}`,
);

const ReadingRow = ({
  reading,
  settled,
  previous,
  valueDecimals,
  showConsumption,
  showEstimated,
  showNotes,
  deletion,
  onEdit,
}: {
  reading: Reading;
  settled: boolean;
  previous: Reading | undefined;
  valueDecimals: number;
  showConsumption: boolean;
  showEstimated: boolean;
  showNotes: boolean;
  deletion: ReturnType<typeof useDeleteResource<Reading>>;
  onEdit: (reading: Reading) => void;
}) => {
  const numberFormat = (value: number, withSign: boolean): string =>
    value.toLocaleString("de-DE", {
      minimumFractionDigits: valueDecimals,
      maximumFractionDigits: valueDecimals,
      signDisplay: withSign ? "exceptZero" : "auto",
    });
  const delta = previous ? reading.value - previous.value : null;

  return (
    <TableRow className={deletion.rowClassName(reading)}>
      <TableCell className="px-4 py-3">
        <RowActions
          isDeleting={reading.id === deletion.deletingId}
          extraActions={
            <RowActionButton
              label={t("ui.common.action.edit")}
              icon={<RiPencilLine />}
              onSelect={() => onEdit(reading)}
            />
          }
          onDelete={() => deletion.request(reading)}
        />
      </TableCell>
      <TableCell className="px-4 py-3 tabular-nums">
        <span className="flex items-center gap-2">
          {formatDate(reading.readingDate)}
          {settled ? (
            <Badge variant="neutral">{t("ui.reading.settledBadge")}</Badge>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
        {numberFormat(reading.value, false)}
      </TableCell>
      {showConsumption ? (
        <TableCell
          className={
            delta !== null && delta < 0
              ? "px-4 py-3 text-right tabular-nums text-himbeere-500"
              : "px-4 py-3 text-right tabular-nums text-muted-foreground"
          }
        >
          {delta === null
            ? t("ui.common.emptyValue")
            : numberFormat(delta, true)}
        </TableCell>
      ) : null}
      <TableCell className="px-4 py-3">
        {meterReadByLabel(reading.readBy)}
      </TableCell>
      {showEstimated ? (
        <TableCell className="px-4 py-3">
          {reading.isEstimated ? t("common.yes") : null}
        </TableCell>
      ) : null}
      {showNotes ? (
        <TableCell className="px-4 py-3 text-muted-foreground">
          {reading.notes ?? ""}
        </TableCell>
      ) : null}
    </TableRow>
  );
};

const decimalPlaces = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const cleaned = Number.parseFloat(value.toFixed(6)).toString();
  const dot = cleaned.indexOf(".");

  return dot === -1 ? 0 : cleaned.length - dot - 1;
};

export const MeterReadingsTab = ({
  meterId,
  buildingId,
  measurementUnit,
  role,
  onEditReading,
}: {
  meterId: string;
  buildingId: string;
  measurementUnit: MeasurementUnit;
  role: MeterRole;
  onEditReading: (reading: Reading) => void;
}) => {
  const isVirtual = role === "virtual_difference";

  const { data: readings, isPending } = useQuery(readingsQueryOptions(meterId));

  const sorted = useMemo(
    () =>
      [...(readings ?? [])].sort((a, b) =>
        b.readingDate.localeCompare(a.readingDate),
      ),
    [readings],
  );

  const valueDecimals = useMemo(
    () =>
      (readings ?? []).reduce(
        (max, reading) => Math.max(max, decimalPlaces(reading.value)),
        0,
      ),
    [readings],
  );

  const _latestReadingDate = sorted[0]?.readingDate;

  const settledPeriods = useSettledPeriods(buildingId);
  const isSettled = (date: string): boolean =>
    isInSettledPeriod(settledPeriods, date);

  const deletion = useDeleteResource<Reading>({
    endpoint: (reading) => `/meters/readings/${reading.id}`,
    invalidateKeys: [["readings", meterId]],
    title: t("ui.reading.confirmDelete"),
    describe: (reading) =>
      isSettled(reading.readingDate)
        ? t("ui.reading.confirmDeleteSettledMessage", {
            date: formatDate(reading.readingDate),
          })
        : t("ui.reading.confirmDeleteMessage", {
            date: formatDate(reading.readingDate),
          }),
  });

  const renderBody = () => {
    if (isVirtual) {
      return <EmptyNote>{t("ui.meters.hints.virtualNoReadings")}</EmptyNote>;
    }
    if (!isPending && sorted.length === 0) {
      return <EmptyNote>{t("ui.meters.noReadings")}</EmptyNote>;
    }
    // Verbrauch (Delta) nur bei mindestens zwei Ständen; die Spalten "Geschätzt"
    // und "Notiz" erst zeigen, wenn wenigstens ein Eintrag sie füllt
    const showConsumption = sorted.length >= 2;
    const showEstimated = sorted.some((reading) => reading.isEstimated);
    const showNotes = sorted.some((reading) => reading.notes?.trim());
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4" />
            <TableHead className="px-4">
              {t("ui.common.columns.date")}
            </TableHead>
            <TableHead className="px-4 text-right">
              {t("ui.reading.fields.valueWithUnit", {
                unit: measurementUnitLabel(measurementUnit),
              })}
            </TableHead>
            {showConsumption ? (
              <TableHead className="px-4 text-right">
                {t("ui.reading.fields.consumptionWithUnit", {
                  unit: measurementUnitLabel(measurementUnit),
                })}
              </TableHead>
            ) : null}
            <TableHead className="px-4">
              {t("ui.reading.fields.readBy")}
            </TableHead>
            {showEstimated ? (
              <TableHead className="px-4">
                {t("ui.common.columns.estimated")}
              </TableHead>
            ) : null}
            {showNotes ? (
              <TableHead className="px-4">
                {t("ui.reading.fields.note")}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending
            ? skeletonRowKeys.map((rowKey) => (
                <TableRow key={rowKey}>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-4 w-6" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-4 w-[70%]" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="ml-auto h-4 w-[60%]" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-4 w-[60%]" />
                  </TableCell>
                </TableRow>
              ))
            : sorted.map((reading, index) => (
                <ReadingRow
                  key={reading.id}
                  reading={reading}
                  settled={isSettled(reading.readingDate)}
                  previous={sorted[index + 1]}
                  valueDecimals={valueDecimals}
                  showConsumption={showConsumption}
                  showEstimated={showEstimated}
                  showNotes={showNotes}
                  deletion={deletion}
                  onEdit={onEditReading}
                />
              ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <SectionCard
      icon={RiListOrdered2}
      title={t("ui.meters.readingsTitle")}
      description={t("ui.meters.readingsDescription")}
    >
      <div className="-mx-2">{renderBody()}</div>
      {deletion.dialog}
    </SectionCard>
  );
};
