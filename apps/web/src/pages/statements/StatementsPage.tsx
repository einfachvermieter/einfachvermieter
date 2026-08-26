import { formatName } from "@einfachvermieter/shared";
import { RiAddLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { BalanceAmount } from "../../components/common/BalanceAmount";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { PrerequisiteEmpty } from "../../components/common/PrerequisiteEmpty";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/Tooltip";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { domainVisuals } from "../../lib/domainVisuals";
import { formatPeriod } from "../../lib/format";
import { t } from "../../lib/i18n";
import { usePrerequisite } from "../../lib/prerequisites";
import {
  type StatementOverviewRow,
  type StatementSortColumn,
  type StatementStatus,
  statementsOverviewQueryOptions,
} from "../../lib/statements";
import { useServerTableState } from "../../lib/tableState";

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
      return <Badge variant="ok">{t("ui.statements.statusFinalized")}</Badge>;

    case "draft":
      return <Badge variant="neutral">{t("ui.statements.statusDraft")}</Badge>;

    case "cancelled":
      return <Badge variant="bad">{t("ui.statements.statusCancelled")}</Badge>;

    case "superseded":
      return (
        <Badge variant="neutral">{t("ui.statements.statusSuperseded")}</Badge>
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

  const { met: canAddStatement, isPending: prereqPending } =
    usePrerequisite("statements");
  const prerequisiteMissing = !canAddStatement && !prereqPending;

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
          formatPeriod(row.original.periodStart, row.original.periodEnd),
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
          const { balanceCents, status } = row.original;
          if (balanceCents === null) {
            // Entwurfssaldo steht erst nach dem Finalisieren fest,
            // deshalb besonders gekennzeichnet
            if (status === "draft") {
              return (
                <Tooltip>
                  <TooltipTrigger asChild={true}>
                    <span className="text-muted-foreground italic">
                      {t("ui.statements.balanceDraftPending")}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("ui.statements.balanceDraftHint")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return (
              <span className="text-muted-foreground">
                {t("ui.common.emptyValue")}
              </span>
            );
          }
          return (
            <BalanceAmount receivableCents={balanceCents} wording="statement" />
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
      <PageHeader
        tile={<PageHeaderIcon icon={domainVisuals.statements.icon} />}
        title={t("ui.statements.pageTitle")}
        sub={sub}
        subLoading={!data}
        action={
          canAddStatement ? (
            <Button asChild={true}>
              <Link to="/abrechnungen/neu">
                <RiAddLine />
                <span className="hidden sm:inline">
                  {t("ui.statements.addStatement")}
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
            <PrerequisiteEmpty domain="statements" />
          ) : (
            emptyMessage
          )
        }
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
