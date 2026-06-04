import {
  RiAddLine,
  RiDashboard3Line,
  RiListOrdered2,
  RiPencilLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { RowActionButton } from "../../components/RowActions";
import { Button } from "../../components/ui/Button";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { t } from "../../lib/i18n";
import {
  type Meter,
  type MeterSortColumn,
  meterRoleLabel,
  metersOverviewQueryOptions,
  meterTypeLabel,
} from "../../lib/meters";
import { statsQueryOptions } from "../../lib/stats";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import { unitsQueryOptions } from "../../lib/units";
import { useDeleteResource } from "../../lib/useDeleteResource";

const SORTABLE_COLUMNS: ReadonlySet<MeterSortColumn> = new Set([
  "label",
  "type",
  "role",
]);

export const MetersOverview = () => {
  const table = useServerTableState<MeterSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "label",
    storageKey: "meters",
  });
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { data: units } = useQuery(unitsQueryOptions);

  const { data, isFetching } = useQuery({
    ...metersOverviewQueryOptions({ ...table.queryParams, buildingId }),
    enabled: buildingId !== undefined,
  });
  const { data: stats } = useQuery(statsQueryOptions());

  const items = data?.items ?? [];

  const deletion = useDeleteResource<Meter>({
    endpoint: (meter) => `/meters/${meter.id}`,
    invalidateKey: ["meters"],
    title: t("ui.meters.confirmDelete"),
    describe: (meter) =>
      t("ui.meters.confirmDeleteMessage", { label: meter.label }),
  });

  const unitName = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of units ?? []) {
      map.set(unit.id, unit.name);
    }
    return (unitId: string | null) =>
      unitId ? (map.get(unitId) ?? t("common.unknown")) : t("common.none");
  }, [units]);

  const columns = useMemo<ColumnDef<Meter>[]>(
    () => [
      rowActionsColumn<Meter>({
        deletion,
        editLink: (meter) => (
          <Link to="/zaehler/$meterId" params={{ meterId: meter.id }}>
            <RiPencilLine />
          </Link>
        ),
        extraActions: (meter) => (
          <RowActionButton label={t("ui.reading.tabs.readings")}>
            <Link
              to="/zaehler/$meterId/zaehlerstaende"
              params={{ meterId: meter.id }}
            >
              <RiListOrdered2 />
            </Link>
          </RowActionButton>
        ),
      }),
      {
        accessorKey: "label",
        header: t("ui.meters.columns.label"),
        cell: ({ row }) => (
          <div>
            <span className="font-semibold">{row.original.label}</span>
            {row.original.serialNumber ? (
              <span className="block text-xs font-normal text-muted-foreground">
                {t("ui.meters.serialNumberShort", {
                  value: row.original.serialNumber,
                })}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: t("ui.common.columns.type"),
        cell: ({ row }) => meterTypeLabel(row.original.type),
      },
      {
        accessorKey: "role",
        header: t("ui.common.columns.role"),
        cell: ({ row }) => meterRoleLabel(row.original.role),
      },
      {
        id: "unit",
        enableSorting: false,
        header: t("ui.common.columns.unit"),
        cell: ({ row }) => unitName(row.original.unitId),
      },
    ],
    [unitName, deletion],
  );

  const trimmedSearch = table.search.trim();
  let emptyMessage: string;
  if (trimmedSearch) {
    emptyMessage = t("ui.meters.emptySearch", { query: trimmedSearch });
  } else if (building) {
    emptyMessage = t("ui.meters.emptyForBuilding", { building: building.name });
  } else {
    emptyMessage = t("ui.meters.empty");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<RiDashboard3Line />}
        title={t("ui.meters.title")}
        action={
          <Button asChild={true}>
            <Link to="/zaehler/neu" search={{ buildingId, type: undefined }}>
              <RiAddLine />
              <span className="hidden sm:inline">{t("ui.meters.add")}</span>
            </Link>
          </Button>
        }
      />

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={stats?.meters}
        emptyMessage={emptyMessage}
        rowClassName={deletion.rowClassName}
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(data?.total ?? 0),
        }}
      />

      {deletion.dialog}
    </div>
  );
};
