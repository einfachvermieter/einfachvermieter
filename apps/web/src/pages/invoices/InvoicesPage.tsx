import { formatDate, formatEur } from "@einfachvermieter/shared";
import { RiAddLine, RiInformationLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { IconTile } from "../../components/common/IconTile";
import { PageHead } from "../../components/common/PageHead";
import { TextWithLink } from "../../components/TextWithLink";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useActiveBuilding } from "../../lib/activeBuilding";
import {
  type CostEntryOverviewRow,
  type CostEntrySortColumn,
  type CostType,
  costEntriesOverviewQueryOptions,
  costTypesQueryOptions,
} from "../../lib/costs";
import { costTypeVisual } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import {
  type DeleteResource,
  useDeleteResource,
} from "../../lib/useDeleteResource";

const SORTABLE_COLUMNS: ReadonlySet<CostEntrySortColumn> = new Set([
  "invoiceDate",
  "amount",
  "vendor",
  "period",
]);

const invoiceColumns = (
  deletion: DeleteResource<CostEntryOverviewRow>,
  costTypeByName: Map<string, CostType>,
): ColumnDef<CostEntryOverviewRow>[] => [
  {
    id: "costType",
    accessorKey: "costTypeNames",
    enableSorting: false,
    header: t("ui.costs.columns.costType"),
    cell: ({ row }) => {
      const [firstName, ...moreNames] = row.original.costTypeNames;
      const firstCostType = firstName
        ? costTypeByName.get(firstName)
        : undefined;
      const visual = costTypeVisual(
        firstCostType ?? { category: "operating", defaultAllocationKey: null },
      );
      return (
        <EntityCell
          tile={<IconTile icon={visual.icon} background={visual.gradient} />}
          name={
            <span className="flex items-center gap-1.5">
              {firstName ?? t("common.unknown")}
              {moreNames.length > 0 ? (
                <Badge variant="morechip">
                  {t("ui.common.moreChip", { count: moreNames.length })}
                </Badge>
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
      t("ui.common.periodLabel", {
        start: formatDate(row.original.periodStart),
        end: formatDate(row.original.periodEnd),
      }),
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
  rowActionsColumn<CostEntryOverviewRow>({ deletion }),
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

  const deletion = useDeleteResource<CostEntryOverviewRow>({
    endpoint: (entry) => `/costs/${entry.id}`,
    invalidateKey: ["costs"],
    title: t("ui.invoices.confirmDelete"),
    describe: (entry) =>
      t("ui.invoices.confirmDeleteMessage", {
        costType: entry.costTypeNames.join(", ") || t("common.unknown"),
        amount: formatEur(entry.amountCents),
        invoiceDate: formatDate(entry.invoiceDate),
      }),
  });

  const costTypeByName = useMemo(
    () =>
      new Map((costTypes ?? []).map((costType) => [costType.name, costType])),
    [costTypes],
  );
  const columns = useMemo(
    () => invoiceColumns(deletion, costTypeByName),
    [deletion, costTypeByName],
  );

  const hasCostTypes = (costTypes ?? []).some(
    (costType) => costType.buildingId === buildingId,
  );
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
      <PageHead
        eyebrow={t("ui.navigation.groups.costsBilling")}
        title={t("ui.invoices.title")}
        sub={sub}
        action={
          <Button
            asChild={true}
            disabled={!hasCostTypes}
            aria-disabled={!hasCostTypes}
          >
            <Link to="/rechnungen/neu">
              <RiAddLine />
              <span className="hidden sm:inline">
                {t("ui.invoices.addEntry")}
              </span>
            </Link>
          </Button>
        }
      />

      {!hasCostTypes && costTypes !== undefined ? (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <RiInformationLine className="mt-0.5 size-4 shrink-0" />
          <span>
            <TextWithLink
              template={t("ui.invoices.noCostTypes")}
              link={
                <Link
                  to="/kostenarten"
                  search={{ buildingId }}
                  className="font-semibold text-foreground underline"
                >
                  {t("ui.costs.title")}
                </Link>
              }
            />
          </span>
        </div>
      ) : null}

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={total}
        emptyMessage={emptyMessage}
        rowClassName={deletion.rowClassName}
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

      {deletion.dialog}
    </div>
  );
};
