import { formatNumber } from "@einfachvermieter/shared";
import { RiAddLine, RiHome6Line, RiPencilLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/Button";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { t } from "../../lib/i18n";
import { statsQueryOptions } from "../../lib/stats";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import {
  type Unit,
  type UnitSortColumn,
  unitsOverviewQueryOptions,
} from "../../lib/units";
import { useDeleteResource } from "../../lib/useDeleteResource";

const SORTABLE_COLUMNS: ReadonlySet<UnitSortColumn> = new Set([
  "name",
  "areaSqm",
]);

export const UnitsOverview = () => {
  const table = useServerTableState<UnitSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "name",
    storageKey: "units",
  });
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { data, isFetching } = useQuery({
    ...unitsOverviewQueryOptions({ ...table.queryParams, buildingId }),
    enabled: buildingId !== undefined,
  });
  const { data: stats } = useQuery(statsQueryOptions());

  const items = data?.items ?? [];

  const deletion = useDeleteResource<Unit>({
    endpoint: (unit) => `/units/${unit.id}`,
    invalidateKey: ["units"],
    title: t("ui.units.confirmDelete"),
    describe: (unit) => t("ui.units.confirmDeleteMessage", { name: unit.name }),
  });

  const columns = useMemo<ColumnDef<Unit>[]>(
    () => [
      rowActionsColumn<Unit>({
        deletion,
        editLink: (unit) => (
          <Link to="/wohnungen/$unitId" params={{ unitId: unit.id }}>
            <RiPencilLine />
          </Link>
        ),
      }),
      {
        accessorKey: "name",
        header: t("ui.units.fields.name"),
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "areaSqm",
        header: t("ui.units.fields.area"),
        cell: ({ row }) => `${formatNumber(row.original.areaSqm, 2)} m²`,
        meta: {
          cellClassName: "text-right tabular-nums",
          headerClassName: "text-right",
        },
      },
    ],
    [deletion],
  );

  const trimmedSearch = table.search.trim();
  let emptyMessage: string;
  if (trimmedSearch) {
    emptyMessage = t("ui.units.emptySearch", { query: trimmedSearch });
  } else if (building) {
    emptyMessage = t("ui.units.emptyForBuilding", { building: building.name });
  } else {
    emptyMessage = t("ui.units.empty");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<RiHome6Line />}
        title={t("ui.units.title")}
        action={
          <Button asChild={true}>
            <Link to="/wohnungen/neu" search={{ buildingId }}>
              <RiAddLine />
              <span className="hidden sm:inline">{t("ui.units.add")}</span>
            </Link>
          </Button>
        }
      />

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={stats?.units}
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
