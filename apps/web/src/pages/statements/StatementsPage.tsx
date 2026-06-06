import { formatDate, formatEur, formatName } from "@einfachvermieter/shared";
import { RiAddLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { PageHead } from "../../components/common/PageHead";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { t } from "../../lib/i18n";
import {
  type StatementOverviewRow,
  type StatementSortColumn,
  type StatementStatus,
  statementsOverviewQueryOptions,
} from "../../lib/statements";
import { useServerTableState } from "../../lib/tableState";
import { tenantsOverviewQueryOptions } from "../../lib/tenants";

const SORTABLE_COLUMNS: ReadonlySet<StatementSortColumn> = new Set([
  "tenant",
  "period",
  "status",
  "balance",
]);

const residentNames = (row: StatementOverviewRow): string =>
  row.contractResidents
    .map((resident) => formatName(resident.firstName, resident.lastName))
    .join(t("ui.common.separators.comma"));

const statusBadge = (status: StatementStatus) => {
  switch (status) {
    case "finalized":
      return (
        <Badge variant="ok" dot={true}>
          {t("ui.statements.statusFinalized")}
        </Badge>
      );

    case "draft":
      return (
        <Badge variant="slate" dot={true}>
          {t("ui.statements.statusDraft")}
        </Badge>
      );

    case "cancelled":
      return (
        <Badge variant="rose" dot={true}>
          {t("ui.statements.statusCancelled")}
        </Badge>
      );

    case "superseded":
      return (
        <Badge variant="slate" dot={true}>
          {t("ui.statements.statusSuperseded")}
        </Badge>
      );

    default:
      return null;
  }
};

export const StatementsPage = () => {
  const table = useServerTableState<StatementSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "period",
    defaultOrder: "desc",
    storageKey: "statements",
  });
  const navigate = useNavigate();
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { data, isFetching } = useQuery({
    ...statementsOverviewQueryOptions({ ...table.queryParams, buildingId }),
    enabled: buildingId !== undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const { data: tenantsCount } = useQuery({
    ...tenantsOverviewQueryOptions({ page: 0, pageSize: 1, buildingId }),
    enabled: buildingId !== undefined,
  });
  const hasTenants = (tenantsCount?.total ?? 0) > 0;

  const columns = useMemo<ColumnDef<StatementOverviewRow>[]>(
    () => [
      {
        id: "tenant",
        accessorKey: "unitName",
        header: t("ui.common.columns.tenant"),
        cell: ({ row }) => {
          const names = residentNames(row.original);
          return (
            <EntityCell
              tile={<InitialsAvatar name={names || row.original.unitName} />}
              name={names || row.original.unitName}
              subline={names ? row.original.unitName : undefined}
            />
          );
        },
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
        id: "status",
        accessorKey: "status",
        header: t("ui.common.columns.status"),
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        id: "balance",
        accessorKey: "balanceCents",
        header: t("ui.statements.columns.balance"),
        cell: ({ row }) => {
          const { balanceCents } = row.original;
          if (balanceCents === null) {
            return (
              <span className="text-muted-foreground">
                {t("ui.common.emptyValue")}
              </span>
            );
          }
          return (
            <span
              className={
                balanceCents > 0
                  ? "font-semibold text-rose-700"
                  : "font-semibold text-teal-700"
              }
            >
              {balanceCents > 0 ? "+" : ""}
              {formatEur(balanceCents)}
            </span>
          );
        },
        meta: {
          cellClassName: "text-right tabular-nums",
          headerClassName: "text-right",
        },
      },
    ],
    [],
  );

  const trimmedSearch = table.search.trim();
  let emptyMessage: string;
  if (trimmedSearch) {
    emptyMessage = t("ui.statements.emptySearch", { query: trimmedSearch });
  } else if (building) {
    emptyMessage = t("ui.statements.emptyForBuilding", {
      building: building.name,
    });
  } else {
    emptyMessage = t("ui.statements.empty");
  }

  const sub = data
    ? [t("ui.statements.sub.count", { count: data.total }), building?.name]
        .filter(Boolean)
        .join(t("ui.common.separators.bullet"))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow={t("ui.navigation.groups.costsBilling")}
        title={t("ui.statements.pageTitle")}
        sub={sub}
        action={
          <Button
            asChild={true}
            disabled={!hasTenants}
            aria-disabled={!hasTenants}
          >
            <Link to="/abrechnungen/neu">
              <RiAddLine />
              <span className="hidden sm:inline">
                {t("ui.statements.addStatement")}
              </span>
            </Link>
          </Button>
        }
      />

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={total}
        emptyMessage={emptyMessage}
        onRowClick={(statement) =>
          navigate({
            to: "/abrechnungen/$statementId",
            params: { statementId: statement.id },
          })
        }
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(total),
          searchPlaceholder: t("ui.statements.searchPlaceholder"),
        }}
      />
    </div>
  );
};
