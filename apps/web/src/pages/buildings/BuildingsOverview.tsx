import { RiAddLine, RiCommunityLine, RiPencilLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/Button";
import {
  type Building,
  type BuildingSortColumn,
  buildingsOverviewQueryOptions,
} from "../../lib/buildings";
import { t } from "../../lib/i18n";
import { statsQueryOptions } from "../../lib/stats";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import { useDeleteResource } from "../../lib/useDeleteResource";

const SORTABLE_COLUMNS: ReadonlySet<BuildingSortColumn> = new Set([
  "name",
  "addressStreet",
  "addressPostalCode",
  "addressCity",
]);

export const BuildingsOverview = () => {
  const table = useServerTableState<BuildingSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "name",
    storageKey: "buildings",
  });

  const { data, isFetching } = useQuery(
    buildingsOverviewQueryOptions(table.queryParams),
  );
  const { data: stats } = useQuery(statsQueryOptions);

  const items = data?.items ?? [];

  const deletion = useDeleteResource<Building>({
    endpoint: (building) => `/buildings/${building.id}`,
    invalidateKey: ["buildings"],
    title: t("ui.buildings.confirmDelete"),
    describe: (building) =>
      t("ui.buildings.confirmDeleteWithUnits", { name: building.name }),
  });

  const columns = useMemo<ColumnDef<Building>[]>(
    () => [
      rowActionsColumn<Building>({
        deletion,
        editLink: (building) => (
          <Link to="/gebaeude/$buildingId" params={{ buildingId: building.id }}>
            <RiPencilLine />
          </Link>
        ),
      }),
      {
        accessorKey: "name",
        header: t("ui.buildings.fields.name"),
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "addressStreet",
        header: t("ui.buildings.columns.street"),
      },
      {
        accessorKey: "addressPostalCode",
        header: t("ui.buildings.fields.postalCode"),
        meta: { cellClassName: "tabular-nums" },
      },
      { accessorKey: "addressCity", header: t("ui.buildings.fields.city") },
    ],
    [deletion],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<RiCommunityLine />}
        title={t("ui.buildings.title")}
        action={
          <Button asChild={true}>
            <Link to="/gebaeude/neu">
              <RiAddLine />
              <span className="hidden sm:inline">{t("ui.buildings.add")}</span>
            </Link>
          </Button>
        }
      />

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching}
        totalRows={stats?.buildings}
        emptyMessage={
          table.search.trim()
            ? t("ui.buildings.emptySearch", { query: table.search.trim() })
            : t("ui.buildings.empty")
        }
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
