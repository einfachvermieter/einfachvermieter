import {
  formatDate,
  type HeatingSettings,
  todayIso,
} from "@einfachvermieter/shared";
import { RiAddLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { PrerequisiteEmpty } from "../../components/common/PrerequisiteEmpty";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { domainVisuals } from "../../lib/domainVisuals";
import { formatPeriod } from "../../lib/format";
import {
  type HeatingOverviewRow,
  type HeatingSortColumn,
  heatingOverviewQueryOptions,
} from "../../lib/heating";
import { t } from "../../lib/i18n";
import { metersOverviewQueryOptions } from "../../lib/meters";
import { usePrerequisite } from "../../lib/prerequisites";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import {
  type DeleteResource,
  useDeleteResource,
} from "../../lib/useDeleteResource";
import { HeatingCreateSheet } from "./HeatingCreateSheet";

const SORTABLE_COLUMNS: ReadonlySet<HeatingSortColumn> = new Set([
  "mode",
  "validFrom",
]);

type Row = HeatingOverviewRow & { id: string };

const isVersionActive = (version: HeatingSettings, today: string): boolean =>
  version.validFrom <= today &&
  (version.validTo === null || version.validTo >= today);

const heatingColumns = (
  deletion: DeleteResource<Row>,
  today: string,
): ColumnDef<Row>[] => [
  {
    accessorKey: "validFrom",
    accessorFn: (row) => row.settings.validFrom,
    header: t("ui.heating.versions.columns.validFrom"),
    cell: ({ row }) => (
      <EntityCell name={formatDate(row.original.settings.validFrom)} />
    ),
    meta: { cellClassName: "tabular-nums" },
  },
  {
    id: "validTo",
    enableSorting: false,
    header: t("ui.heating.versions.columns.validTo"),
    cell: ({ row }) =>
      row.original.settings.validTo === null
        ? t("ui.heating.versions.openEnd")
        : formatDate(row.original.settings.validTo),
    meta: { cellClassName: "tabular-nums" },
  },
  {
    accessorKey: "mode",
    accessorFn: (row) => row.settings.mode,
    header: t("ui.heating.columns.mode"),
    cell: ({ row }) => t(`ui.heating.modes.${row.original.settings.mode}`),
  },
  {
    id: "split",
    enableSorting: false,
    header: t("ui.heating.versions.columns.split"),
    cell: ({ row }) => {
      const { settings } = row.original;

      if (settings.mode !== "internal") {
        return (
          <span className="text-muted-foreground">
            {t("ui.heating.summary.externalNoConfig")}
          </span>
        );
      }

      return (
        <span className="text-muted-foreground">
          {t("ui.heating.summary.split", {
            base: settings.baseSharePercent,
            consumption: settings.consumptionSharePercent,
          })}
        </span>
      );
    },
    meta: { cellClassName: "tabular-nums" },
  },
  {
    id: "heatingType",
    enableSorting: false,
    header: t("ui.heating.versions.columns.heatingType"),
    cell: ({ row }) => {
      if (row.original.settings.mode !== "internal") {
        return (
          <span className="text-muted-foreground">
            {t("ui.heating.summary.none")}
          </span>
        );
      }
      return t(`ui.heating.heatingTypes.${row.original.settings.heatingType}`);
    },
  },
  {
    id: "status",
    enableSorting: false,
    header: t("ui.heating.versions.columns.status"),
    cell: ({ row }) => {
      const active = isVersionActive(row.original.settings, today);
      return active ? (
        <Badge variant="ok">{t("ui.heating.versions.statusActive")}</Badge>
      ) : (
        <Badge variant="neutral">
          {t("ui.heating.versions.statusArchived")}
        </Badge>
      );
    },
  },
  rowActionsColumn<Row>({ deletion }),
];

export const HeatingOverviewPage = () => {
  const table = useServerTableState<HeatingSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "validFrom",
    defaultOrder: "desc",
    storageKey: "heating",
  });
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { data, isFetching } = useQuery({
    ...heatingOverviewQueryOptions({
      page: table.pagination.pageIndex,
      pageSize: table.pagination.pageSize,
      sort: table.sortColumn,
      order: table.order,
      q: table.search.trim() || undefined,
      buildingId,
    }),
    enabled: buildingId !== undefined,
  });

  // Fernablesbare Geräte lösen die Pflicht zu unterjährigen
  // Verbrauchsinformationen aus (§ 6a Abs. 1/2 HeizkostenV) - die Seite
  // weist darauf hin, weil die App diese Mitteilungen nicht erstellt.
  const { data: metersData } = useQuery({
    ...metersOverviewQueryOptions({ page: 0, pageSize: 1000, buildingId }),
    enabled: buildingId !== undefined,
  });
  const hasRemoteReadableMeters = (metersData?.items ?? []).some(
    (meter) => meter.isRemoteReadable && meter.isActive,
  );

  const deletion = useDeleteResource<Row>({
    endpoint: (row) => `/buildings/${row.building.id}/heating/${row.id}`,
    invalidateKeys: [["heating"]],
    title: t("ui.heating.versions.confirmDelete"),
    describe: (row) =>
      t("ui.heating.versions.confirmDeleteMessage", {
        building: row.building.name,
        period: formatPeriod(row.settings.validFrom, row.settings.validTo),
      }),
  });

  const items = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((row) => ({
        ...row,
        id: row.settings.id,
      })),
    [data?.items],
  );
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / table.pagination.pageSize));
  const today = todayIso();

  const { met: canAddHeating, isPending: prereqPending } =
    usePrerequisite("heating");
  const prerequisiteMissing = !canAddHeating && !prereqPending;

  const columns = useMemo(
    () => heatingColumns(deletion, today),
    [today, deletion],
  );

  const trimmedSearch = table.search.trim();
  let emptyMessage: string;
  if (trimmedSearch) {
    emptyMessage = t("ui.heating.emptySearch", { query: trimmedSearch });
  } else if (building) {
    emptyMessage = t("ui.heating.emptyForBuilding", {
      building: building.name,
    });
  } else {
    emptyMessage = t("ui.heating.empty");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        tile={<PageHeaderIcon icon={domainVisuals.heating.icon} />}
        title={t("ui.heating.title")}
        sub={
          building
            ? t("ui.heating.sub", { building: building.name })
            : undefined
        }
        subLoading={!building}
        action={
          canAddHeating ? (
            <Button onClick={() => setCreateOpen(true)}>
              <RiAddLine />
              <span className="hidden sm:inline">
                {t("ui.heating.versions.add")}
              </span>
            </Button>
          ) : undefined
        }
      />

      {hasRemoteReadableMeters ? (
        <Alert variant="info">
          <AlertTitle>{t("ui.heating.remoteReadableNotice.title")}</AlertTitle>
          <AlertDescription>
            {t("ui.heating.remoteReadableNotice.text")}
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={total}
        emptyMessage={
          prerequisiteMissing ? (
            <PrerequisiteEmpty domain="heating" />
          ) : (
            emptyMessage
          )
        }
        rowClassName={deletion.rowClassName}
        onRowClick={(row) =>
          navigate({ to: "/heizkosten/$id", params: { id: row.id } })
        }
        server={{
          pagination: table.pagination,
          onPaginationChange: table.setPagination,
          sorting: table.sorting,
          onSortingChange: table.setSorting,
          search: table.search,
          onSearchChange: table.setSearch,
          pageCount,
        }}
      />

      {createOpen ? (
        <HeatingCreateSheet onClose={() => setCreateOpen(false)} />
      ) : null}

      {deletion.dialog}
    </div>
  );
};
