import { RiAddLine, RiArrowRightUpLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { IconTile } from "../../components/common/IconTile";
import { PageHead } from "../../components/common/PageHead";
import { ROW_TITLE_LINK } from "../../components/common/tableStyles";
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
import { useServerTableState } from "../../lib/tableState";

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
  const { data: stats } = useQuery(statsQueryOptions(buildingId));

  const items = data?.items ?? [];

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
              name={
                <Link
                  to="/kostenarten/$costTypeId"
                  params={{ costTypeId: row.original.id }}
                  className={ROW_TITLE_LINK}
                >
                  {row.original.name}
                </Link>
              }
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
                    className="inline-flex items-center gap-0.5 text-sky-700 underline-offset-4 hover:underline dark:text-sky-400"
                  >
                    {t("ui.costs.allocationHeatingSettlement")}
                    <RiArrowRightUpLine
                      className="size-3.5"
                      aria-hidden={true}
                    />
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
    ],
    [buildingId],
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
    </div>
  );
};
