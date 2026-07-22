import { RiAddLine, RiListOrdered2 } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { IconTile } from "../../components/common/IconTile";
import { PageHeader } from "../../components/common/PageHeader";
import { PrerequisiteEmpty } from "../../components/common/PrerequisiteEmpty";
import { ROW_TITLE_LINK } from "../../components/common/tableStyles";
import { RowActionButton } from "../../components/RowActions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useActiveBuilding } from "../../lib/activeBuilding";
import {
  domainVisuals,
  gradients,
  meterTypeVisual,
} from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import {
  type Meter,
  type MeterSortColumn,
  meterRoleLabel,
  metersOverviewQueryOptions,
  meterTypeLabel,
} from "../../lib/meters";
import { usePrerequisite } from "../../lib/prerequisites";
import { statsQueryOptions } from "../../lib/stats";
import { rowActionsColumn } from "../../lib/tableColumns";
import { useServerTableState } from "../../lib/tableState";
import { unitsQueryOptions } from "../../lib/units";

const SORTABLE_COLUMNS: ReadonlySet<MeterSortColumn> = new Set([
  "label",
  "type",
  "role",
]);

const routeApi = getRouteApi("/zaehler");

/**
 * Wohnungs-/Unterzähler sky, Allgemeinzähler indigo,
 * Hauptzähler und Differenzzähler slate
 */
const roleBadgeVariant = (role: Meter["role"]) => {
  if (role === "unit" || role === "sub") {
    return "blue";
  }
  if (role === "common") {
    return "indigo";
  }
  return "slate";
};

const roleBadge = (role: Meter["role"]) => (
  <Badge variant={roleBadgeVariant(role)}>{meterRoleLabel(role)}</Badge>
);

export const MetersOverview = () => {
  const table = useServerTableState<MeterSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "label",
    storageKey: "meters",
  });
  const navigate = useNavigate();
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { met: canAddMeter, isPending: prereqPending } =
    usePrerequisite("meters");
  const { data: units } = useQuery(unitsQueryOptions);
  const { unitId: unitIdFilter } = routeApi.useSearch();

  const { data, isFetching } = useQuery({
    ...metersOverviewQueryOptions({
      ...table.queryParams,
      buildingId,
      unitId: unitIdFilter,
    }),
    enabled: buildingId !== undefined,
  });
  const { data: stats } = useQuery(statsQueryOptions(buildingId));

  const items = data?.items ?? [];

  const unitName = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of units ?? []) {
      map.set(unit.id, unit.name);
    }
    return (unitId: string | null) =>
      unitId ? (map.get(unitId) ?? t("common.unknown")) : null;
  }, [units]);

  const columns = useMemo<ColumnDef<Meter>[]>(
    () => [
      {
        accessorKey: "label",
        header: t("ui.meters.columns.label"),
        cell: ({ row }) => {
          const visual = meterTypeVisual(row.original.type);
          return (
            <EntityCell
              tile={
                <IconTile icon={visual.icon} background={visual.gradient} />
              }
              name={
                <Link
                  to="/zaehler/$meterId"
                  params={{ meterId: row.original.id }}
                  className={ROW_TITLE_LINK}
                >
                  {row.original.label}
                </Link>
              }
              subline={
                row.original.serialNumber
                  ? t("ui.meters.serialNumberShort", {
                      value: row.original.serialNumber,
                    })
                  : undefined
              }
              mono={true}
            />
          );
        },
      },
      {
        accessorKey: "type",
        header: t("ui.common.columns.type"),
        cell: ({ row }) => meterTypeLabel(row.original.type),
      },
      {
        accessorKey: "role",
        header: t("ui.common.columns.role"),
        cell: ({ row }) => roleBadge(row.original.role),
      },
      {
        id: "unit",
        enableSorting: false,
        header: t("ui.common.columns.unit"),
        cell: ({ row }) => {
          const name = unitName(row.original.unitId);
          return (
            name ?? (
              <span className="text-muted-foreground">
                {t("ui.common.emptyValue")}
              </span>
            )
          );
        },
      },

      rowActionsColumn<Meter>({
        extraActions: (meter) => (
          <RowActionButton label={t("ui.reading.tabs.readings")}>
            <Link
              to="/zaehler/$meterId/zaehlerstaende"
              params={{ meterId: meter.id }}
            >
              <RiListOrdered2 />
            </Link>
          </RowActionButton>
        ),
      }),
    ],
    [unitName],
  );

  const prerequisiteMissing = !canAddMeter && !prereqPending;
  const trimmedSearch = table.search.trim();
  let emptyMessage: string;
  if (trimmedSearch) {
    emptyMessage = t("ui.meters.emptySearch", { query: trimmedSearch });
  } else if (building) {
    emptyMessage = t("ui.meters.emptyForBuilding", { building: building.name });
  } else {
    emptyMessage = t("ui.meters.empty");
  }

  const sub = data
    ? [t("ui.meters.sub.count", { count: data.total }), building?.name]
        .filter(Boolean)
        .join(t("ui.common.separators.bullet"))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        tile={
          <IconTile
            icon={domainVisuals.meters.icon}
            size={44}
            background={gradients.water}
          />
        }
        title={t("ui.meters.title")}
        sub={sub}
        subLoading={!data}
        action={
          canAddMeter ? (
            <Button asChild={true}>
              <Link
                to="/zaehler/neu"
                search={{ buildingId, type: undefined, unitId: undefined }}
              >
                <RiAddLine />
                <span className="hidden sm:inline">{t("ui.meters.add")}</span>
              </Link>
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={stats?.meters}
        emptyMessage={
          prerequisiteMissing ? (
            <PrerequisiteEmpty domain="meters" />
          ) : (
            emptyMessage
          )
        }
        onRowClick={(meter) =>
          navigate({ to: "/zaehler/$meterId", params: { meterId: meter.id } })
        }
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(data?.total ?? 0),
        }}
      />
    </div>
  );
};
