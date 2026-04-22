import { formatDate, formatEur, formatName } from "@einfachvermieter/shared";
import {
  RiAddLine,
  RiInformationLine,
  RiPencilLine,
  RiTeamLine,
  RiWallet3Line,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { RowActionButton } from "../../components/RowActions";
import { TextWithLink } from "../../components/TextWithLink";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  allTenantBalancesQueryOptions,
  type TenantBalanceSummary,
} from "../../lib/accounts";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { t } from "../../lib/i18n";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import {
  type TenantOverviewRow,
  type TenantSortColumn,
  tenantKindLabel,
  tenantsOverviewQueryOptions,
} from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import {
  type DeleteResource,
  useDeleteResource,
} from "../../lib/useDeleteResource";

const SORTABLE_COLUMNS: ReadonlySet<TenantSortColumn> = new Set([
  "unit",
  "kind",
  "resident",
  "term",
  "rent",
  "status",
  "occupants",
]);

const tenantColumns = (
  deletion: DeleteResource<TenantOverviewRow>,
  summaryById: Map<string, TenantBalanceSummary>,
): ColumnDef<TenantOverviewRow>[] => [
  rowActionsColumn<TenantOverviewRow>({
    deletion,
    editLink: (row) => (
      <Link to="/mieter/$tenantId" params={{ tenantId: row.id }}>
        <RiPencilLine />
      </Link>
    ),
    extraActions: (row) => (
      <RowActionButton label={t("ui.tenants.openAccount")}>
        <Link to="/mieter/$tenantId/konto" params={{ tenantId: row.id }}>
          <RiWallet3Line />
        </Link>
      </RowActionButton>
    ),
  }),
  {
    id: "unit",
    accessorKey: "unitName",
    header: t("ui.common.columns.unit"),
    cell: ({ row }) => (
      <span className="font-semibold">{row.original.unitName}</span>
    ),
  },
  {
    id: "kind",
    accessorKey: "kind",
    header: t("ui.tenants.columns.kind"),
    cell: ({ row }) => tenantKindLabel(row.original.kind),
  },
  {
    id: "resident",
    enableSorting: true,
    header: t("ui.common.columns.contractParty"),
    cell: ({ row }) =>
      row.original.contractResidents.length === 0
        ? t("common.none")
        : row.original.contractResidents
            .map((r) => formatName(r.firstName, r.lastName))
            .join(t("ui.common.separators.comma")),
  },
  {
    id: "occupants",
    accessorKey: "currentOccupants",
    header: t("ui.tenants.columns.occupants"),
    cell: ({ row }) => row.original.currentOccupants,
    meta: {
      cellClassName: "text-right tabular-nums",
      headerClassName: "text-right",
    },
  },
  {
    id: "term",
    accessorKey: "startDate",
    header: t("ui.tenants.columns.term"),
    cell: ({ row }) =>
      t("ui.common.periodLabel", {
        start: formatDate(row.original.startDate),
        end: row.original.endDate
          ? formatDate(row.original.endDate)
          : t("errors.tenantOpenEnd"),
      }),
    meta: { cellClassName: "tabular-nums" },
  },
  {
    id: "rent",
    accessorKey: "currentRentCents",
    header: t("ui.tenant.fields.coldRent"),
    cell: ({ row }) => formatEur(row.original.currentRentCents),
    meta: {
      cellClassName: "text-right tabular-nums",
      headerClassName: "text-right",
    },
  },
  {
    id: "status",
    accessorKey: "active",
    header: t("ui.common.columns.status"),
    cell: ({ row }) =>
      row.original.active ? (
        <Badge variant="lightGreen">{t("ui.tenants.active")}</Badge>
      ) : (
        <Badge variant="lightYellow">{t("ui.tenants.inactive")}</Badge>
      ),
  },
  {
    id: "accountBalance",
    enableSorting: false,
    header: t("ui.account.columns.balance"),
    cell: ({ row }) => {
      const summary = summaryById.get(row.original.id);
      if (summary === undefined) {
        return t("common.loadingShort");
      }

      return (
        <Link
          to="/mieter/$tenantId/konto"
          params={{ tenantId: row.original.id }}
          className="underline-offset-4 hover:underline"
        >
          {formatEur(summary.balanceCents)}
        </Link>
      );
    },
    meta: {
      cellClassName: "text-right tabular-nums font-semibold",
      headerClassName: "text-right",
    },
  },
  {
    id: "deposit",
    enableSorting: false,
    header: t("ui.account.columns.deposit"),
    cell: ({ row }) => {
      const summary = summaryById.get(row.original.id);
      if (summary === undefined) {
        return t("common.loadingShort");
      }

      return summary.depositCents > 0
        ? formatEur(summary.depositCents)
        : t("common.none");
    },
    meta: {
      cellClassName: "text-right tabular-nums",
      headerClassName: "text-right",
    },
  },
];

export const TenantsPage = () => {
  const table = useServerTableState<TenantSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "term",
    defaultOrder: "desc",
    storageKey: "tenants",
  });
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { data: units } = useQuery(unitsQueryOptions);

  const { data, isFetching } = useQuery({
    ...tenantsOverviewQueryOptions({ ...table.queryParams, buildingId }),
    enabled: buildingId !== undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const { data: balances } = useQuery({
    ...allTenantBalancesQueryOptions({ buildingId }),
    enabled: buildingId !== undefined,
  });
  const summaryById = useMemo(() => {
    const map = new Map<string, TenantBalanceSummary>();
    for (const entry of balances ?? []) {
      map.set(entry.tenantId, entry);
    }
    return map;
  }, [balances]);

  const deletion = useDeleteResource<TenantOverviewRow>({
    endpoint: (row) => `/tenants/${row.id}`,
    invalidateKey: ["tenants"],
    title: t("ui.tenants.confirmDeleteTenant"),
    describe: (row) =>
      t("ui.tenants.confirmDeleteTenantMessage", {
        unit: row.unitName,
        start: formatDate(row.startDate),
        end: row.endDate ? formatDate(row.endDate) : t("errors.tenantOpenEnd"),
      }),
  });

  const columns = useMemo(
    () => tenantColumns(deletion, summaryById),
    [deletion, summaryById],
  );

  const hasUnits = (units ?? []).some((unit) => unit.buildingId === buildingId);
  const trimmedSearch = table.search.trim();
  let emptyMessage: string;
  if (trimmedSearch) {
    emptyMessage = t("ui.tenants.emptySearch", { query: trimmedSearch });
  } else if (building) {
    emptyMessage = t("ui.tenants.emptyForBuilding", {
      building: building.name,
    });
  } else {
    emptyMessage = t("ui.tenants.empty");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<RiTeamLine />}
        title={t("ui.tenants.title")}
        action={
          <Button asChild={true} disabled={!hasUnits} aria-disabled={!hasUnits}>
            <Link to="/mieter/neu">
              <RiAddLine />
              <span className="hidden sm:inline">
                {t("ui.tenants.addTenant")}
              </span>
            </Link>
          </Button>
        }
      />

      {!hasUnits && units !== undefined ? (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <RiInformationLine className="mt-0.5 size-4 shrink-0" />
          <span>
            <TextWithLink
              template={t("ui.tenants.noUnits")}
              link={
                <Link
                  to="/wohnungen"
                  search={{ buildingId }}
                  className="font-semibold text-foreground underline"
                >
                  {t("ui.units.title")}
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
