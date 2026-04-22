import { formatDate, todayIso } from "@einfachvermieter/shared";
import { RiAddLine, RiPencilLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { RowActionButton, RowActions } from "@/components/RowActions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { api } from "../../../../lib/api";
import { t } from "../../../../lib/i18n";
import {
  type MeasurementUnit,
  type MeterRole,
  measurementUnitLabel,
  meterReadByLabel,
  type Reading,
  readingsQueryOptions,
} from "../../../../lib/meters";
import { useCrudMutation } from "../../../../lib/useCrudMutation";
import { useDeleteResource } from "../../../../lib/useDeleteResource";
import { ReadingForm } from "./ReadingForm";
import type {
  ReadingFormValues,
  ReadingSubmitValues,
} from "./readingForm.schema";

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
  measurementUnit,
  role,
}: {
  meterId: string;
  measurementUnit: MeasurementUnit;
  role: MeterRole;
}) => {
  const isVirtual = role === "virtual_difference";
  const [editTarget, setEditTarget] = useState<Reading | null | "new">(null);

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

  const latestReadingDate = sorted[0]?.readingDate;

  const createMutation = useCrudMutation({
    mutationFn: (dto: ReadingSubmitValues) =>
      api.post<Reading>("/meters/readings", { ...dto, meterId }),
    invalidateKeys: [["readings", meterId]],
    onSuccess: () => setEditTarget(null),
  });

  const updateMutation = useCrudMutation({
    mutationFn: (variables: { id: string; dto: ReadingSubmitValues }) =>
      api.patch<Reading>(`/meters/readings/${variables.id}`, variables.dto),
    invalidateKeys: [["readings", meterId]],
    onSuccess: () => setEditTarget(null),
  });

  const deletion = useDeleteResource<Reading>({
    endpoint: (reading) => `/meters/readings/${reading.id}`,
    invalidateKey: ["readings", meterId],
    title: t("ui.reading.confirmDelete"),
    describe: (reading) =>
      t("ui.reading.confirmDeleteMessage", {
        date: formatDate(reading.readingDate),
      }),
  });

  const dialogOpen = editTarget !== null;
  const dialogEntry = editTarget && editTarget !== "new" ? editTarget : null;

  const defaultValues: ReadingFormValues = dialogEntry
    ? {
        readingDate: dialogEntry.readingDate,
        value: String(dialogEntry.value).replace(".", ","),
        isEstimated: dialogEntry.isEstimated,
        readBy: dialogEntry.readBy,
        notes: dialogEntry.notes ?? "",
      }
    : {
        readingDate: todayIso(),
        value: "",
        isEstimated: false,
        readBy: "landlord",
        notes: "",
      };

  const skeletonRowKeys = useMemo(
    () => Array.from({ length: 5 }, (_, index) => `reading-skeleton-${index}`),
    [],
  );

  const renderBody = () => {
    if (isVirtual) {
      return (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("ui.meters.hints.virtualNoReadings")}
          </p>
        </CardContent>
      );
    }
    if (!isPending && sorted.length === 0) {
      return (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("ui.meters.noReadings")}
          </p>
        </CardContent>
      );
    }
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
            <TableHead className="px-4">
              {t("ui.reading.fields.readBy")}
            </TableHead>
            <TableHead className="px-4">
              {t("ui.common.columns.estimated")}
            </TableHead>
            <TableHead className="px-4">
              {t("ui.reading.fields.note")}
            </TableHead>
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
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-4 w-[40%]" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Skeleton className="h-4 w-[80%]" />
                  </TableCell>
                </TableRow>
              ))
            : sorted.map((reading) => (
                <TableRow
                  key={reading.id}
                  className={deletion.rowClassName(reading)}
                >
                  <TableCell className="px-4 py-3">
                    <RowActions
                      isDeleting={reading.id === deletion.deletingId}
                      extraActions={
                        <RowActionButton
                          label={t("ui.common.action.edit")}
                          icon={<RiPencilLine />}
                          onSelect={() => setEditTarget(reading)}
                        />
                      }
                      onDelete={() => deletion.request(reading)}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3 tabular-nums">
                    {formatDate(reading.readingDate)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
                    {reading.value.toLocaleString("de-DE", {
                      minimumFractionDigits: valueDecimals,
                      maximumFractionDigits: valueDecimals,
                    })}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {meterReadByLabel(reading.readBy)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {reading.isEstimated ? t("common.yes") : null}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {reading.notes ?? ""}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("ui.meters.readingsTitle")}</CardTitle>
          {isVirtual ? null : (
            <Button type="button" onClick={() => setEditTarget("new")}>
              <RiAddLine />
              <span className="hidden sm:inline">
                {t("ui.meters.addReading")}
              </span>
            </Button>
          )}
        </div>
      </CardHeader>
      {renderBody()}
      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {dialogEntry
              ? t("ui.reading.editTitle")
              : t("ui.reading.createTitle")}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {dialogOpen ? (
            <ReadingForm
              defaultValues={defaultValues}
              warnIfBefore={dialogEntry ? null : (latestReadingDate ?? null)}
              onSubmit={async (values) => {
                if (dialogEntry) {
                  await updateMutation.mutateAsync({
                    id: dialogEntry.id,
                    dto: values,
                  });
                } else {
                  await createMutation.mutateAsync(values);
                }
              }}
              onCancel={() => setEditTarget(null)}
              submitting={createMutation.isPending || updateMutation.isPending}
            />
          ) : null}
        </ResponsiveDialogBody>
      </ResponsiveDialog>
      {deletion.dialog}
    </Card>
  );
};
