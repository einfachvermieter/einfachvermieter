import { RiAddLine, RiCommunityLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { Button } from "../../components/ui/Button";
import {
  type Building,
  type BuildingSortColumn,
  buildingsOverviewQueryOptions,
} from "../../lib/buildings";
import { t } from "../../lib/i18n";
import { statsQueryOptions } from "../../lib/stats";
import { useServerTableState } from "../../lib/tableState";
import { BuildingCreateSheet } from "./BuildingCreateSheet";

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
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isFetching } = useQuery(
    buildingsOverviewQueryOptions(table.queryParams),
  );
  const { data: stats } = useQuery(statsQueryOptions());

  const items = data?.items ?? [];

  const columns = useMemo<ColumnDef<Building>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("ui.buildings.fields.name"),
        cell: ({ row }) => <EntityCell name={row.original.name} />,
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
      {
        accessorKey: "unitsCount",
        enableSorting: false,
        header: t("ui.buildings.columns.units"),
        meta: {
          cellClassName: "text-right tabular-nums",
          headerClassName: "text-right",
        },
      },
      {
        accessorKey: "activeTenantsCount",
        enableSorting: false,
        header: t("ui.buildings.columns.activeTenants"),
        meta: {
          cellClassName: "text-right tabular-nums",
          headerClassName: "text-right",
        },
      },
    ],
    [],
  );

  const sub = data
    ? t("ui.dashboard.sub.buildings", { count: data.total })
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        tile={<PageHeaderIcon icon={RiCommunityLine} />}
        title={t("ui.buildings.title")}
        sub={sub}
        subLoading={!data}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <RiAddLine />
            <span className="hidden sm:inline">{t("ui.buildings.add")}</span>
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

      {createOpen ? (
        <BuildingCreateSheet onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
};
