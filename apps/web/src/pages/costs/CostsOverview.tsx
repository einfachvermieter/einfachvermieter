import {
  RiAddLine,
  RiFireLine,
  RiPencilLine,
  RiPieChartLine,
  RiPriceTag3Line,
  RiSpeedUpLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { PageHeader } from "../../components/PageHeader";
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
  type CostCategory,
  type CostType,
  type CostTypeSortColumn,
  costCategoryFor,
  costTypeCategoryLabel,
  costTypesOverviewQueryOptions,
} from "../../lib/costs";
import { t } from "../../lib/i18n";
import { statsQueryOptions } from "../../lib/stats";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import { useDeleteResource } from "../../lib/useDeleteResource";

const SORTABLE_COLUMNS: ReadonlySet<CostTypeSortColumn> = new Set([
  "name",
  "category",
]);

const categoryBadge = (category: CostCategory) => {
  if (category === "byShare") {
    return (
      <Badge variant="lightBlue">
        <RiPieChartLine />
        {t("ui.invoices.categoryBadges.byShare")}
      </Badge>
    );
  }
  if (category === "byConsumption") {
    return (
      <Badge variant="lightGreen">
        <RiSpeedUpLine />
        {t("ui.invoices.categoryBadges.byConsumption")}
      </Badge>
    );
  }
  return (
    <Badge variant="lightYellow">
      <RiFireLine />
      {t("ui.invoices.categoryBadges.heating")}
    </Badge>
  );
};

export const CostsOverview = () => {
  const table = useServerTableState<CostTypeSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "name",
    storageKey: "costTypes",
  });
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { data, isFetching } = useQuery({
    ...costTypesOverviewQueryOptions({ ...table.queryParams, buildingId }),
    enabled: buildingId !== undefined,
  });
  const { data: stats } = useQuery(statsQueryOptions);

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
      rowActionsColumn<CostType>({
        deletion,
        editLink: (costType) => (
          <Link
            to="/kostenarten/$costTypeId"
            params={{ costTypeId: costType.id }}
          >
            <RiPencilLine />
          </Link>
        ),
      }),
      {
        accessorKey: "name",
        header: t("ui.common.columns.name"),
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "category",
        header: t("ui.costs.columns.category"),
        cell: ({ row }) => costTypeCategoryLabel(row.original.category),
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
      {
        id: "kind",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) =>
          categoryBadge(
            costCategoryFor(
              row.original.category,
              row.original.defaultAllocationKey,
            ),
          ),
      },
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<RiPriceTag3Line />}
        title={t("ui.costs.title")}
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
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(data?.total ?? 0),
        }}
      />

      {deletion.dialog}
    </div>
  );
};
