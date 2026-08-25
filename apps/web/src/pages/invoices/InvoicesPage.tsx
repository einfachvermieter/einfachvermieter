import { formatDate, formatEur } from "@einfachvermieter/shared";
import { RiAddLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { PrerequisiteEmpty } from "../../components/common/PrerequisiteEmpty";
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
  type CostEntryOverviewRow,
  type CostEntrySortColumn,
  type CostType,
  costEntriesOverviewQueryOptions,
  costTypesQueryOptions,
} from "../../lib/costs";
import { costTypeVisual, domainVisuals } from "../../lib/domainVisuals";
import { formatPeriod } from "../../lib/format";
import { t } from "../../lib/i18n";
import { usePrerequisite } from "../../lib/prerequisites";
import { rowIconColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";

const SORTABLE_COLUMNS: ReadonlySet<CostEntrySortColumn> = new Set([
  "invoiceDate",
  "amount",
  "vendor",
  "period",
]);

const invoiceColumns = (
  costTypeByName: Map<string, CostType>,
): ColumnDef<CostEntryOverviewRow>[] => [
  // Icon nach der ersten Kostenart der Rechnung
  rowIconColumn<CostEntryOverviewRow>((entry) => {
    const [firstName] = entry.costTypeNames;
    const firstCostType = firstName ? costTypeByName.get(firstName) : undefined;
    return costTypeVisual(
      firstCostType ?? { category: "operating", defaultAllocationKey: null },
    ).icon;
  }),
  {
    id: "costType",
    accessorKey: "costTypeNames",
    enableSorting: false,
    header: t("ui.invoices.columns.invoice"),
    cell: ({ row }) => {
      const [firstName, ...moreNames] = row.original.costTypeNames;
      return (
        <EntityCell
          name={
            <span className="flex items-center gap-1.5">
              <Link
                to="/rechnungen/$costEntryId"
                params={{ costEntryId: row.original.id }}
                className={ROW_TITLE_LINK}
              >
                {firstName ?? t("common.unknown")}
              </Link>
              {moreNames.length > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild={true}>
                    <Badge variant="morechip">
                      {t("ui.common.moreChip", { count: moreNames.length })}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("ui.invoices.moreCostTypesTooltip", {
                      names: moreNames.join(t("ui.common.separators.comma")),
                    })}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </span>
          }
        />
      );
    },
  },
  {
    id: "invoiceDate",
    accessorKey: "invoiceDate",
    header: t("ui.common.columns.invoiceDate"),
    cell: ({ row }) => formatDate(row.original.invoiceDate),
    meta: { cellClassName: "tabular-nums" },
  },
  {
    id: "period",
    accessorKey: "periodStart",
    header: t("ui.common.columns.period"),
    cell: ({ row }) =>
      formatPeriod(row.original.periodStart, row.original.periodEnd),
    meta: { cellClassName: "tabular-nums" },
  },
  {
    id: "amount",
    accessorKey: "amountCents",
    header: t("ui.common.columns.amount"),
    cell: ({ row }) => formatEur(row.original.amountCents),
    meta: {
      cellClassName: "text-right tabular-nums font-semibold",
      headerClassName: "text-right",
    },
  },
  {
    id: "invoiceNumber",
    enableSorting: false,
    accessorKey: "invoiceNumber",
    header: t("ui.costs.columns.invoiceNumber"),
    cell: ({ row }) =>
      row.original.invoiceNumber ? (
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {row.original.invoiceNumber}
        </span>
      ) : (
        <span className="text-muted-foreground">
          {t("ui.common.emptyValue")}
        </span>
      ),
  },
  {
    id: "vendor",
    accessorKey: "vendor",
    header: t("ui.costs.columns.vendor"),
    cell: ({ row }) =>
      row.original.vendor ?? (
        <span className="text-muted-foreground">
          {t("ui.common.emptyValue")}
        </span>
      ),
  },
];

export const InvoicesPage = () => {
  const table = useServerTableState<CostEntrySortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "invoiceDate",
    defaultOrder: "desc",
    storageKey: "invoices",
  });
  const navigate = useNavigate();
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { data: costTypes } = useQuery(costTypesQueryOptions);

  const { data, isFetching } = useQuery({
    ...costEntriesOverviewQueryOptions({ ...table.queryParams, buildingId }),
    enabled: buildingId !== undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const costTypeByName = useMemo(
    () =>
      new Map((costTypes ?? []).map((costType) => [costType.name, costType])),
    [costTypes],
  );
  const columns = useMemo(
    () => invoiceColumns(costTypeByName),
    [costTypeByName],
  );

  const { met: canAddInvoice, isPending: prereqPending } =
    usePrerequisite("invoices");
  const prerequisiteMissing = !canAddInvoice && !prereqPending;
  const trimmedSearch = table.search.trim();
  let emptyMessage: string;
  if (trimmedSearch) {
    emptyMessage = t("ui.invoices.emptySearch", { query: trimmedSearch });
  } else if (building) {
    emptyMessage = t("ui.invoices.emptyForBuilding", {
      building: building.name,
    });
  } else {
    emptyMessage = t("ui.invoices.empty");
  }

  const sub = data
    ? [
        t("ui.invoices.sub.count", { count: data.total }),
        building?.name,
        t("ui.invoices.sub.totalAmount", {
          amount: formatEur(data.totalAmountCents),
        }),
      ]
        .filter(Boolean)
        .join(t("ui.common.separators.bullet"))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        tile={<PageHeaderIcon icon={domainVisuals.invoices.icon} />}
        title={t("ui.invoices.title")}
        sub={sub}
        subLoading={!data}
        action={
          canAddInvoice ? (
            <Button asChild={true}>
              <Link to="/rechnungen/neu">
                <RiAddLine />
                <span className="hidden sm:inline">
                  {t("ui.invoices.addEntry")}
                </span>
              </Link>
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={total}
        emptyMessage={
          prerequisiteMissing ? (
            <PrerequisiteEmpty domain="invoices" />
          ) : (
            emptyMessage
          )
        }
        onRowClick={(entry) =>
          navigate({
            to: "/rechnungen/$costEntryId",
            params: { costEntryId: entry.id },
          })
        }
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(total),
        }}
      />
    </div>
  );
};
