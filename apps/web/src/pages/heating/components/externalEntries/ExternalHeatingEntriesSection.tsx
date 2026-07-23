import type {
  ExternalHeatingEntry,
  ExternalHeatingEntryCreateDto,
} from "@einfachvermieter/shared";
import { formatDate, formatEur } from "@einfachvermieter/shared";
import { RiAddLine, RiPencilLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Description } from "@/components/common/Description";
import { RowActionButton, RowActions } from "@/components/RowActions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  createExternalHeatingEntry,
  externalHeatingEntriesQueryOptions,
  updateExternalHeatingEntry,
} from "../../../../lib/heating";
import { t } from "../../../../lib/i18n";
import { type Unit, unitsQueryOptions } from "../../../../lib/units";
import { useCrudMutation } from "../../../../lib/useCrudMutation";
import { useDeleteResource } from "../../../../lib/useDeleteResource";
import { ExternalHeatingEntryForm } from "./ExternalHeatingEntryForm";

export const ExternalHeatingEntriesSection = ({
  buildingId,
}: {
  buildingId: string;
}) => {
  const [editTarget, setEditTarget] = useState<
    ExternalHeatingEntry | null | "new"
  >(null);

  const { data: entries } = useQuery(
    externalHeatingEntriesQueryOptions(buildingId),
  );
  const { data: allUnits } = useQuery(unitsQueryOptions);

  const buildingUnits = useMemo<Unit[]>(
    () => (allUnits ?? []).filter((unit) => unit.buildingId === buildingId),
    [allUnits, buildingId],
  );

  const unitById = useMemo(() => {
    const map = new Map<string, Unit>();
    for (const unit of buildingUnits) {
      map.set(unit.id, unit);
    }
    return map;
  }, [buildingUnits]);

  const createMutation = useCrudMutation({
    mutationFn: (dto: ExternalHeatingEntryCreateDto) =>
      createExternalHeatingEntry(buildingId, dto),
    invalidateKeys: [["heating", buildingId, "external-entries"]],
    onSuccess: () => setEditTarget(null),
  });

  const updateMutation = useCrudMutation({
    mutationFn: (variables: {
      id: string;
      dto: ExternalHeatingEntryCreateDto;
    }) => updateExternalHeatingEntry(variables.id, variables.dto),
    invalidateKeys: [["heating", buildingId, "external-entries"]],
    onSuccess: () => setEditTarget(null),
  });

  const deletion = useDeleteResource<ExternalHeatingEntry>({
    endpoint: (entry) => `/heating/external-entries/${entry.id}`,
    invalidateKeys: [["heating", buildingId, "external-entries"]],
    title: t("ui.heating.external.confirmDelete"),
    describe: (entry) =>
      t("ui.heating.external.confirmDeleteMessage", {
        unit: unitById.get(entry.unitId)?.name ?? t("common.unknown"),
        start: formatDate(entry.periodStart),
        end: formatDate(entry.periodEnd),
      }),
  });

  const sorted = useMemo(
    () =>
      [...(entries ?? [])].sort((a, b) => {
        if (a.periodStart !== b.periodStart) {
          return a.periodStart < b.periodStart ? -1 : 1;
        }
        const nameA = unitById.get(a.unitId)?.name ?? "";
        const nameB = unitById.get(b.unitId)?.name ?? "";
        return nameA.localeCompare(nameB, "de");
      }),
    [entries, unitById],
  );

  const dialogOpen = editTarget !== null;
  const dialogEntry = editTarget && editTarget !== "new" ? editTarget : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("ui.heating.external.title")}</CardTitle>
            <Description>{t("ui.heating.external.description")}</Description>
          </div>
          <Button
            type="button"
            disabled={buildingUnits.length === 0}
            aria-disabled={buildingUnits.length === 0}
            onClick={() => setEditTarget("new")}
          >
            <RiAddLine />
            <span className="hidden sm:inline">
              {t("ui.heating.external.add")}
            </span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("ui.heating.external.empty")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>{t("ui.heating.external.columns.period")}</TableHead>
                <TableHead>{t("ui.heating.external.columns.unit")}</TableHead>
                <TableHead className="text-right">
                  {t("ui.heating.external.columns.total")}
                </TableHead>
                <TableHead className="text-right">
                  {t("ui.heating.external.columns.base")}
                </TableHead>
                <TableHead className="text-right">
                  {t("ui.heating.external.columns.consumption")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={deletion.rowClassName(entry)}
                >
                  <TableCell>
                    <RowActions
                      isDeleting={entry.id === deletion.deletingId}
                      extraActions={
                        <RowActionButton
                          label={t("ui.common.action.edit")}
                          icon={<RiPencilLine />}
                          onSelect={() => setEditTarget(entry)}
                        />
                      }
                      onDelete={() => deletion.request(entry)}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {t("ui.common.periodLabel", {
                      start: formatDate(entry.periodStart),
                      end: formatDate(entry.periodEnd),
                    })}
                  </TableCell>
                  <TableCell>
                    {unitById.get(entry.unitId)?.name ?? t("common.unknown")}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatEur(entry.totalCents)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {entry.baseCostCents === null
                      ? t("common.none")
                      : formatEur(entry.baseCostCents)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {entry.consumptionCostCents === null
                      ? t("common.none")
                      : formatEur(entry.consumptionCostCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogEntry
                ? t("ui.common.action.edit")
                : t("ui.heating.external.add")}
            </DialogTitle>
            <DialogDescription>
              {t("ui.heating.external.description")}
            </DialogDescription>
          </DialogHeader>
          {dialogOpen ? (
            <ExternalHeatingEntryForm
              units={buildingUnits}
              defaultEntry={dialogEntry}
              onCancel={() => setEditTarget(null)}
              onSubmit={async (dto) => {
                if (dialogEntry) {
                  await updateMutation.mutateAsync({
                    id: dialogEntry.id,
                    dto,
                  });
                } else {
                  await createMutation.mutateAsync(dto);
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {deletion.dialog}
    </Card>
  );
};
