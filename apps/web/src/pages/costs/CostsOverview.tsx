import { RiAddLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { IconTile } from "../../components/common/IconTile";
import { PageHead } from "../../components/common/PageHead";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/Tooltip";
import { useActiveBuilding } from "../../lib/activeBuilding";
import {
  allocationLabel,
  type CostType,
  type CostTypeSortColumn,
  costTypeCategoryLabel,
  costTypesOverviewQueryOptions,
} from "../../lib/costs";
import { costTypeVisual } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { statsQueryOptions } from "../../lib/stats";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import { useDeleteResource } from "../../lib/useDeleteResource";

const SORTABLE_COLUMNS: ReadonlySet<CostTypeSortColumn> = new Set([
  "name",
  "category",
]);

export const CostsOverview = () => {
  const table = useServerTableState<CostTypeSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "name",
    storageKey: "costTypes",
  });
  const navigate = useNavigate();
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { data, isFetching } = useQuery({
    ...costTypesOverviewQueryOptions({ ...table.queryParams, buildingId }),
    enabled: buildingId !== undefined,
  });
  const { data: stats } = useQuery(statsQueryOptions());

  const items = data?.items ?? [];

  const deletion = useDeleteResource<CostType>({
    endpoint: (costType) => `/costs/types/${costType.id}`,
    invalidateKey: ["costTypes"],
    title: t("ui.costs.confirmDeleteType"),
    describe: (costType) =>
      t("ui.costs.confirmDeleteTypeMessage", { name: costType.name }),
  });

  const columns = useMemo<ColumnDef<CostType>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("ui.common.columns.name"),
        cell: ({ row }) => {
          const visual = costTypeVisual(row.original);
          return (
            <EntityCell
              tile={
                <IconTile icon={visual.icon} background={visual.gradient} />
              }
              name={row.original.name}
            />
          );
        },
      },
      {
        accessorKey: "category",
        header: t("ui.costs.columns.category"),
        cell: ({ row }) => (
          <Badge
            variant={row.original.category === "heating" ? "warn" : "blue"}
          >
            {costTypeCategoryLabel(row.original.category)}
          </Badge>
        ),
      },
      {
        id: "allocation",
        enableSorting: false,
        header: t("ui.costs.columns.allocation"),
        cell: ({ row }) => {
          if (row.original.defaultAllocationKey) {
            return allocationLabel(row.original.defaultAllocationKey);
          }
          if (row.original.category === "heating") {
            return (
              <Tooltip>
                <TooltipTrigger asChild={true}>
                  <Link
                    to="/heizkosten"
                    search={{ buildingId }}
                    className="text-sky-700 underline"
                  >
                    {t("ui.costs.allocationHeatingSettlement")}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  {t("ui.costs.allocationHeatingSettlementTooltip")}
                </TooltipContent>
              </Tooltip>
            );
          }
          return t("ui.costs.allocationKeyNotApplicable");
        },
      },
      // Löschen bleibt bis Phase 4 (Aktionen-Karte der Detailseite)
      rowActionsColumn<CostType>({ deletion }),
    ],
    [deletion, buildingId],
  );

  const trimmedSearch = table.search.trim();
  let emptyMessage: string;
  if (trimmedSearch) {
    emptyMessage = t("ui.costs.emptySearch", { query: trimmedSearch });
  } else if (building) {
    emptyMessage = t("ui.costs.emptyForBuilding", { building: building.name });
  } else {
    emptyMessage = t("ui.costs.empty");
  }

  const sub = data
    ? [t("ui.costs.sub.count", { count: data.total }), building?.name]
        .filter(Boolean)
        .join(t("ui.common.separators.bullet"))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow={t("ui.navigation.groups.costsBilling")}
        title={t("ui.costs.title")}
        sub={sub}
        action={
          <Button asChild={true}>
            <Link to="/kostenarten/neu" search={{ buildingId }}>
              <RiAddLine />
              <span className="hidden sm:inline">{t("ui.costs.addType")}</span>
            </Link>
          </Button>
        }
      />

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={stats?.costTypes}
        emptyMessage={emptyMessage}
        rowClassName={deletion.rowClassName}
        onRowClick={(costType) =>
          navigate({
            to: "/kostenarten/$costTypeId",
            params: { costTypeId: costType.id },
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
