import { formatEur, formatName } from "@einfachvermieter/shared";
import { RiAddLine, RiWallet3Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { BalanceAmount } from "../../components/common/BalanceAmount";
import { DataTable } from "../../components/common/DataTable";
import { DomainLink } from "../../components/common/DomainLink";
import { EntityCell } from "../../components/common/EntityCell";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { PrerequisiteEmpty } from "../../components/common/PrerequisiteEmpty";
import { RowActionButton } from "../../components/RowActions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  allTenantBalancesQueryOptions,
  type TenantBalanceSummary,
} from "../../lib/accounts";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { domainVisuals } from "../../lib/domainVisuals";
import { formatPeriod } from "../../lib/format";
import { t } from "../../lib/i18n";
import { usePrerequisite } from "../../lib/prerequisites";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import {
  type TenantOverviewRow,
  type TenantSortColumn,
  tenantKindLabel,
  tenantsOverviewQueryOptions,
} from "../../lib/tenants";
import { TenantCreateSheet } from "./TenantCreateSheet";

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
      return <EntityCell name={names || t("common.none")} />;
    },
  },
  {
    id: "unit",
    accessorKey: "unitName",
    header: t("ui.common.columns.unit"),
    cell: ({ row }) => (
      <DomainLink
        to="/wohnungen/$unitId"
        params={{ unitId: row.original.unitId }}
      >
        {row.original.unitName}
      </DomainLink>
    ),
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
      formatPeriod(row.original.startDate, row.original.endDate),
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
        <Badge variant="ok">{t("ui.tenants.active")}</Badge>
      ) : (
        <Badge variant="neutral">{t("ui.tenants.inactive")}</Badge>
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

      // Kontosaldo ist aus Mietersicht signiert, die Anzeige aus Vermietersicht
      return (
        <DomainLink
          to="/mieter/$tenantId/konto"
          params={{ tenantId: row.original.id }}
        >
          <BalanceAmount receivableCents={-summary.balanceCents} />
        </DomainLink>
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
  const [createOpen, setCreateOpen] = useState(false);
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { met: canAddTenant, isPending: prereqPending } =
    usePrerequisite("tenants");

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

  const prerequisiteMissing = !canAddTenant && !prereqPending;
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
      <PageHeader
        tile={<PageHeaderIcon icon={domainVisuals.tenants.icon} />}
        title={t("ui.tenants.title")}
        sub={sub}
        subLoading={!data}
        action={
          canAddTenant ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <RiAddLine />
              <span className="hidden sm:inline">
                {t("ui.tenants.addTenant")}
              </span>
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
            <PrerequisiteEmpty domain="tenants" />
          ) : (
            emptyMessage
          )
        }
        onRowClick={(row) =>
          navigate({ to: "/mieter/$tenantId", params: { tenantId: row.id } })
        }
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(total),
        }}
      />

      {createOpen ? (
        <TenantCreateSheet onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
};
