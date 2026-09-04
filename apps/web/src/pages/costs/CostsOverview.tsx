import { RiAddLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { DataTable } from "../../components/common/DataTable";
import { DomainLink } from "../../components/common/DomainLink";
import { EntityCell } from "../../components/common/EntityCell";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { PrerequisiteEmpty } from "../../components/common/PrerequisiteEmpty";
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
import { costTypeVisual, domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { usePrerequisite } from "../../lib/prerequisites";
import { statsQueryOptions } from "../../lib/stats";
import { rowIconColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import { CostTypeCreateSheet } from "./CostTypeCreateSheet";

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
  const [createOpen, setCreateOpen] = useState(false);
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
  const { met: canAddCostType, isPending: prereqPending } =
    usePrerequisite("costTypes");
  const prerequisiteMissing = !canAddCostType && !prereqPending;

  const items = data?.items ?? [];

  const columns = useMemo<ColumnDef<CostType>[]>(
    () => [
      rowIconColumn<CostType>((costType) => costTypeVisual(costType).icon),
      {
        accessorKey: "name",
        header: t("ui.common.columns.name"),
        cell: ({ row }) => <EntityCell name={row.original.name} />,
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
                  <DomainLink to="/heizkosten" search={{ buildingId }}>
                    {t("ui.costs.allocationHeatingSettlement")}
                  </DomainLink>
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
      <PageHeader
        tile={<PageHeaderIcon icon={domainVisuals.costTypes.icon} />}
        title={t("ui.costs.title")}
        sub={sub}
        subLoading={!data}
        action={
          canAddCostType ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <RiAddLine />
              <span className="hidden sm:inline">{t("ui.costs.addType")}</span>
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={stats?.costTypes}
        emptyMessage={
          prerequisiteMissing ? (
            <PrerequisiteEmpty domain="costTypes" />
          ) : (
            emptyMessage
          )
        }
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

      {createOpen ? (
        <CostTypeCreateSheet onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
};
