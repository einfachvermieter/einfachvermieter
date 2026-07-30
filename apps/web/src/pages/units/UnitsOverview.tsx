import { formatNumber, pad2 } from "@einfachvermieter/shared";
import { RiAddLine, RiHome4Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../components/common/DataTable";
import { EntityCell } from "../../components/common/EntityCell";
import { IconTile } from "../../components/common/IconTile";
import { PageHeader } from "../../components/common/PageHeader";
import { PrerequisiteEmpty } from "../../components/common/PrerequisiteEmpty";
import { ROW_TITLE_LINK } from "../../components/common/tableStyles";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { usePrerequisite } from "../../lib/prerequisites";
import { statsQueryOptions } from "../../lib/stats";
import { useServerTableState } from "../../lib/tableState";
import {
  type UnitOverviewRow,
  type UnitSortColumn,
  unitsOverviewQueryOptions,
} from "../../lib/units";

const SORTABLE_COLUMNS: ReadonlySet<UnitSortColumn> = new Set([
  "name",
  "areaSqm",
  "status",
  "tenant",
]);

/**
 * "frei ab MM/JJJJ" bezieht sich auf den Monat nach Vertragsende
 */
const vacantFromMonth = (vacantFrom: string): string => {
  const dayAfterEnd = new Date(`${vacantFrom}T00:00:00Z`);
  dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1);
  return `${pad2(dayAfterEnd.getUTCMonth() + 1)}/${dayAfterEnd.getUTCFullYear()}`;
};

const occupancyBadge = (occupancy: UnitOverviewRow["occupancy"]) => {
  switch (occupancy.status) {
    case "rented":
      return (
        <Badge variant="ok" dot={true}>
          {t("ui.units.status.rented")}
        </Badge>
      );
    case "vacant_from":
      return (
        <Badge variant="warn" dot={true}>
          {t("ui.units.status.vacantFrom", {
            month: occupancy.vacantFrom
              ? vacantFromMonth(occupancy.vacantFrom)
              : "",
          })}
        </Badge>
      );
    case "owner":
      return (
        <Badge variant="slate" dot={true}>
          {t("ui.units.status.owner")}
        </Badge>
      );
    default:
      return (
        <Badge variant="warn" dot={true}>
          {t("ui.units.status.vacant")}
        </Badge>
      );
  }
};

export const UnitsOverview = () => {
  const table = useServerTableState<UnitSortColumn>({
    allowedSorts: SORTABLE_COLUMNS,
    defaultSort: "name",
    storageKey: "units",
  });
  const navigate = useNavigate();
  const {
    buildingId,
    building,
    isPending: buildingsPending,
  } = useActiveBuilding();

  const { data, isFetching } = useQuery({
    ...unitsOverviewQueryOptions({ ...table.queryParams, buildingId }),
    enabled: buildingId !== undefined,
  });
  const { data: stats } = useQuery(statsQueryOptions(buildingId));
  const { met: canAddUnit, isPending: prereqPending } =
    usePrerequisite("units");
  const prerequisiteMissing = !canAddUnit && !prereqPending;

  const items = data?.items ?? [];

  const columns = useMemo<ColumnDef<UnitOverviewRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("ui.units.fields.name"),
        cell: ({ row }) => (
          <EntityCell
            tile={<IconTile icon={RiHome4Line} background={gradients.units} />}
            name={
              <Link
                to="/wohnungen/$unitId"
                params={{ unitId: row.original.id }}
                className={ROW_TITLE_LINK}
              >
                {row.original.name}
              </Link>
            }
          />
        ),
      },
      {
        accessorKey: "unitNumber",
        enableSorting: false,
        header: t("ui.units.fields.unitNumber"),
        cell: ({ row }) => row.original.unitNumber ?? t("ui.common.emptyValue"),
      },
      {
        accessorKey: "areaSqm",
        header: t("ui.units.fields.area"),
        cell: ({ row }) => `${formatNumber(row.original.areaSqm, 2)}\u00A0m²`,
        meta: {
          cellClassName: "text-right tabular-nums",
          headerClassName: "text-right",
        },
      },
      {
        id: "status",
        header: t("ui.units.status.label"),
        cell: ({ row }) => occupancyBadge(row.original.occupancy),
      },
      {
        id: "tenant",
        header: t("ui.units.fields.tenant"),
        cell: ({ row }) =>
          row.original.occupancy.tenantNames.join(
            t("ui.common.separators.comma"),
          ) || t("ui.common.emptyValue"),
      },
    ],
    [],
  );

  const trimmedSearch = table.search.trim();
  let emptyMessage: string;
  if (trimmedSearch) {
    emptyMessage = t("ui.units.emptySearch", { query: trimmedSearch });
  } else if (building) {
    emptyMessage = t("ui.units.emptyForBuilding", { building: building.name });
  } else {
    emptyMessage = t("ui.units.empty");
  }

  const sub = data
    ? [
        t("ui.units.sub.count", { count: data.total }),
        building?.name,
        t("ui.units.sub.rented", { count: data.rentedCount }),
      ]
        .filter(Boolean)
        .join(t("ui.common.separators.bullet"))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        tile={
          <IconTile icon={RiHome4Line} size={44} background={gradients.units} />
        }
        title={t("ui.units.title")}
        sub={sub}
        subLoading={!data}
        action={
          canAddUnit ? (
            <Button asChild={true}>
              <Link to="/wohnungen/neu" search={{ buildingId }}>
                <RiAddLine />
                <span className="hidden sm:inline">{t("ui.units.add")}</span>
              </Link>
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={items}
        columns={columns}
        loading={isFetching || buildingsPending}
        totalRows={stats?.units}
        emptyMessage={
          prerequisiteMissing ? (
            <PrerequisiteEmpty domain="units" />
          ) : (
            emptyMessage
          )
        }
        onRowClick={(unit) =>
          navigate({
            to: "/wohnungen/$unitId",
            params: { unitId: unit.id },
          })
        }
        server={{
          ...table.serverProps,
          pageCount: table.pageCount(data?.total ?? 0),
        }}
      />
    </div>
  );
};
