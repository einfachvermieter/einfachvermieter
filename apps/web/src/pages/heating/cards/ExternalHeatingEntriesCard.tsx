import type {
  ExternalHeatingEntry,
  ExternalHeatingEntryCreateDto,
} from "@einfachvermieter/shared";
import { formatDate, formatEur } from "@einfachvermieter/shared";
import { RiAddLine, RiExternalLinkLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EmptyNote } from "@/components/common/EmptyNote";
import { SectionCard } from "@/components/common/SectionCard";
import { RowActions } from "@/components/RowActions";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatPeriod } from "../../../lib/format";
import {
  createExternalHeatingEntry,
  externalHeatingEntriesQueryOptions,
  updateExternalHeatingEntry,
} from "../../../lib/heating";
import { t } from "../../../lib/i18n";
import { type Unit, unitsQueryOptions } from "../../../lib/units";
import { useCrudMutation } from "../../../lib/useCrudMutation";
import { useDeleteResource } from "../../../lib/useDeleteResource";
import { ExternalHeatingEntrySheet } from "../sheets/ExternalHeatingEntrySheet";

/**
 * Endbeträge aus der Abrechnung eines Wärmedienstleisters, je Wohnung und
 * Zeitraum. Nur im externen Modus sichtbar.
 */
export const ExternalHeatingEntriesCard = ({
  buildingId,
}: {
  buildingId: string;
}) => {
  const [sheetTarget, setSheetTarget] = useState<
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
  });

  const updateMutation = useCrudMutation({
    mutationFn: (variables: {
      id: string;
      dto: ExternalHeatingEntryCreateDto;
    }) => updateExternalHeatingEntry(variables.id, variables.dto),
    invalidateKeys: [["heating", buildingId, "external-entries"]],
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

  const totalCents = sorted.reduce((sum, entry) => sum + entry.totalCents, 0);
  const coveredUnits = new Set(sorted.map((entry) => entry.unitId)).size;
  const sheetEntry = sheetTarget === "new" ? null : sheetTarget;

  return (
    <SectionCard
      icon={RiExternalLinkLine}
      title={t("ui.heating.external.title")}
      description={t("ui.heating.external.description")}
      action={
        <Button
          type="button"
          variant="addLink"
          size="text"
          disabled={buildingUnits.length === 0}
          onClick={() => setSheetTarget("new")}
        >
          <RiAddLine />
          {t("ui.heating.external.add")}
        </Button>
      }
    >
      {sorted.length === 0 ? (
        <EmptyNote>{t("ui.heating.external.empty")}</EmptyNote>
      ) : (
        <>
          <div className="-mx-3.5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ui.heating.external.columns.unit")}</TableHead>
                  <TableHead>
                    {t("ui.heating.external.columns.period")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("ui.heating.external.columns.total")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("ui.heating.external.columns.base")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("ui.heating.external.columns.consumption")}
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className={deletion.rowClassName(entry)}
                  >
                    <TableCell className="font-semibold">
                      {unitById.get(entry.unitId)?.name ?? t("common.unknown")}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPeriod(entry.periodStart, entry.periodEnd)}
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
                    <TableCell>
                      <RowActions
                        isDeleting={entry.id === deletion.deletingId}
                        onEdit={() => setSheetTarget(entry)}
                        onDelete={() => deletion.request(entry)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{t("ui.heating.external.sum")}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {formatEur(totalCents)}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("ui.heating.external.coverage", {
              covered: coveredUnits,
              total: buildingUnits.length,
            })}
          </p>
        </>
      )}

      {sheetTarget !== null ? (
        <ExternalHeatingEntrySheet
          units={buildingUnits}
          entry={sheetEntry}
          onSubmit={async (dto) => {
            if (sheetEntry) {
              await updateMutation.mutateAsync({ id: sheetEntry.id, dto });
            } else {
              await createMutation.mutateAsync(dto);
            }
            setSheetTarget(null);
          }}
          onClose={() => setSheetTarget(null)}
        />
      ) : null}

      {deletion.dialog}
    </SectionCard>
  );
};
