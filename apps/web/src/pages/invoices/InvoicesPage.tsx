import { formatDate, formatEur } from "@einfachvermieter/shared";
import {
  RiAddLine,
  RiBillLine,
  RiInformationLine,
  RiPencilLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { TextWithLink } from "../../components/TextWithLink";
import { Button } from "../../components/ui/Button";
import { useActiveBuilding } from "../../lib/activeBuilding";
import {
  type CostEntryOverviewRow,
  type CostEntrySortColumn,
  costEntriesOverviewQueryOptions,
  costTypesQueryOptions,
} from "../../lib/costs";
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
): ColumnDef<CostEntryOverviewRow>[] => [
  rowActionsColumn<CostEntryOverviewRow>({
    deletion,
    editLink: (entry) => (
      <Link to="/rechnungen/$costEntryId" params={{ costEntryId: entry.id }}>
        <RiPencilLine />
      </Link>
    ),
  }),
  {
    id: "costType",
    accessorKey: "costTypeNames",
    enableSorting: false,
    header: t("ui.costs.columns.costType"),
    cell: ({ row }) => (
      <ul className="flex flex-col">
        {row.original.costTypeNames.map((name) => (
          <li key={name} className="font-semibold">
            {name}
          </li>
        ))}
      </ul>
    ),
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
      row.original.invoiceNumber ?? (
        <span className="text-muted-foreground">{t("common.none")}</span>
      ),
  },
  {
    id: "vendor",
    accessorKey: "vendor",
    header: t("ui.costs.columns.vendor"),
    cell: ({ row }) =>
      row.original.vendor ?? (
        <span className="text-muted-foreground">{t("common.none")}</span>
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

  const columns = useMemo(() => invoiceColumns(deletion), [deletion]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<RiBillLine />}
        title={t("ui.invoices.title")}
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
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(total),
        }}
      />

      {deletion.dialog}
    </div>
  );
};
