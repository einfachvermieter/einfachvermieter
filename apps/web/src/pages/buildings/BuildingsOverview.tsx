import { RiAddLine, RiBuilding4Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { IconTile } from "../../components/common/IconTile";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/ui/Button";
import {
  type Building,
  type BuildingSortColumn,
  buildingsOverviewQueryOptions,
} from "../../lib/buildings";
import { gradients } from "../../lib/domainVisuals";
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
  const navigate = useNavigate();

  const { data, isFetching } = useQuery(
    buildingsOverviewQueryOptions(table.queryParams),
  );
  const { data: stats } = useQuery(statsQueryOptions());

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
      {
        accessorKey: "name",
        header: t("ui.buildings.fields.name"),
        cell: ({ row }) => (
          <EntityCell
            tile={<InitialsAvatar name={row.original.name} />}
            name={row.original.name}
            subline={[
              t("ui.navigation.buildingSwitcher.unitsCount", {
                count: row.original.unitsCount,
              }),
              t("ui.dashboard.buildingsCard.tenantsCount", {
                count: row.original.activeTenantsCount,
              }),
            ].join(t("ui.common.separators.bullet"))}
          />
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
      // @todo: Löschen bleibt hier, bis die Gebäude-Detailseite eine Aktionen-Karte hat
      rowActionsColumn<Building>({ deletion }),
    ],
    [deletion],
  );

  const sub = data
    ? t("ui.dashboard.sub.buildings", { count: data.total })
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        tile={
          <IconTile
            icon={RiBuilding4Line}
            size={44}
            background={gradients.buildings}
          />
        }
        title={t("ui.buildings.title")}
        sub={sub}
        subLoading={!data}
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
        onRowClick={(building) =>
          navigate({
            to: "/gebaeude/$buildingId",
            params: { buildingId: building.id },
          })
        }
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(data?.total ?? 0),
        }}
      />

      {deletion.dialog}
    </div>
  );
};
