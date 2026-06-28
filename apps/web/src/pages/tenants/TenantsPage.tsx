import { formatDate, formatEur, formatName } from "@einfachvermieter/shared";
import { RiAddLine, RiInformationLine, RiWallet3Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { PageHead } from "../../components/common/PageHead";
import { ROW_TITLE_LINK } from "../../components/common/tableStyles";
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

const SORTABLE_COLUMNS: ReadonlySet<TenantSortColumn> = new Set([
  "unit",
  "kind",
  "resident",
  "term",
  "rent",
  "status",
  "occupants",
]);

const contractPartyNames = (row: TenantOverviewRow): string =>
  row.contractResidents
    .map((resident) => formatName(resident.firstName, resident.lastName))
    .join(t("ui.common.separators.comma"));

const tenantColumns = (
  summaryById: Map<string, TenantBalanceSummary>,
): ColumnDef<TenantOverviewRow>[] => [
  {
    id: "resident",
    enableSorting: true,
    header: t("ui.common.columns.contractParty"),
    cell: ({ row }) => {
      const names = contractPartyNames(row.original);
      return (
        <EntityCell
          tile={<InitialsAvatar name={names || row.original.unitName} />}
          name={
            <Link
              to="/mieter/$tenantId"
              params={{ tenantId: row.original.id }}
              className={ROW_TITLE_LINK}
            >
              {names || t("common.none")}
            </Link>
          }
          subline={row.original.unitName}
        />
      );
    },
  },
  {
    id: "kind",
    accessorKey: "kind",
    header: t("ui.tenants.columns.kind"),
    cell: ({ row }) => tenantKindLabel(row.original.kind),
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
      row.original.endDate
        ? t("ui.common.periodLabel", {
            start: formatDate(row.original.startDate),
            end: formatDate(row.original.endDate),
          })
        : t("ui.tenants.termSince", {
            date: formatDate(row.original.startDate),
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
        <Badge variant="ok" dot={true}>
          {t("ui.tenants.active")}
        </Badge>
      ) : (
        <Badge variant="slate" dot={true}>
          {t("ui.tenants.inactive")}
        </Badge>
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
          className={
            summary.balanceCents < 0
              ? "text-rose-600 underline-offset-4 hover:underline dark:text-rose-400"
              : "underline-offset-4 hover:underline"
          }
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
  // Konto-Schnellzugriff bleibt als Icon-Button vor dem Chevron
  rowActionsColumn<TenantOverviewRow>({
    extraActions: (row) => (
      <RowActionButton label={t("ui.tenants.openAccount")}>
        <Link to="/mieter/$tenantId/konto" params={{ tenantId: row.id }}>
          <RiWallet3Line />
        </Link>
      </RowActionButton>
    ),
  }),
];

export const TenantsPage = () => {
  const table = useServerTableState<TenantSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "term",
    defaultOrder: "desc",
    storageKey: "tenants",
  });
  const navigate = useNavigate();
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

  const columns = useMemo(() => tenantColumns(summaryById), [summaryById]);

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

  let activePart: string | undefined;
  if (data) {
    activePart =
      data.activeCount === data.total && data.total > 0
        ? t("ui.tenants.sub.allActive")
        : t("ui.tenants.sub.active", { count: data.activeCount });
  }
  const sub = data
    ? [
        t("ui.tenants.sub.count", { count: data.total }),
        building?.name,
        activePart,
      ]
        .filter(Boolean)
        .join(t("ui.common.separators.bullet"))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow={t("ui.navigation.groups.masterData")}
        title={t("ui.tenants.title")}
        sub={sub}
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
        onRowClick={(row) =>
          navigate({ to: "/mieter/$tenantId", params: { tenantId: row.id } })
        }
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(total),
        }}
      />
    </div>
  );
};
