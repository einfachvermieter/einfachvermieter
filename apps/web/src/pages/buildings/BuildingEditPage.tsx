import { type BuildingCreateDto, formatNumber } from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiMoreLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { DomainLink } from "../../components/common/DomainLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { MiniKpiRow } from "../../components/common/MiniKpiRow";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Button } from "../../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
import { api } from "../../lib/api";
import { type Building, buildingQueryOptions } from "../../lib/buildings";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { unitsOverviewQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { BuildingBaseCard } from "./cards/BuildingBaseCard";
import { BuildingUnitsCard } from "./cards/BuildingUnitsCard";
import { BuildingSheet } from "./sheets/BuildingSheet";

const routeApi = getRouteApi("/gebaeude/$buildingId");

/**
 * Gebäude-Ansicht: Kopf, Kennzahlen, Stammdaten als Werte-Card
 */
export const BuildingEditPage = () => {
  const { buildingId } = routeApi.useParams();

  // Aus der Query statt aus den Loader-Daten: nach dem Speichern im Sheet
  // steht der neue Stand sofort in der Ansicht.
  const buildingQuery = useQuery(buildingQueryOptions(buildingId));
  const building = buildingQuery.data;

  const { data: units } = useQuery({
    ...unitsOverviewQueryOptions({ page: 0, pageSize: 1000, buildingId }),
    enabled: building !== undefined,
  });

  const navigate = useNavigate();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const updateBuilding = useCrudMutation({
    mutationFn: (dto: BuildingCreateDto) =>
      api.patch<Building>(`/buildings/${buildingId}`, dto),
    invalidateKeys: [["buildings"], ["building", buildingId]],
  });

  const deletion = useDeleteResource<Building>({
    endpoint: (target) => `/buildings/${target.id}`,
    invalidateKeys: [["buildings"], ["stats"]],
    title: t("ui.buildings.confirmDelete"),
    describe: (target) =>
      t("ui.buildings.confirmDeleteWithUnits", { name: target.name }),
    onDeleted: () => navigate({ to: "/gebaeude" }),
  });

  if (buildingQuery.isError || (!building && !buildingQuery.isLoading)) {
    return (
      <EntityNotFound
        title={t("ui.buildings.notFound.title")}
        description={t("ui.buildings.notFound.description")}
        to="/gebaeude"
      />
    );
  }

  if (!building) {
    return (
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon icon={domainVisuals.buildings.icon} />}
          title=""
          loading={true}
        />
        <FormSkeleton rows={4} />
      </div>
    );
  }

  const unitRows = units?.items ?? [];
  const totalArea = unitRows.reduce((sum, unit) => sum + unit.areaSqm, 0);

  return (
    <>
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon icon={domainVisuals.buildings.icon} />}
          title={building.name}
          sub={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {[
                  building.addressStreet,
                  `${building.addressPostalCode} ${building.addressCity}`,
                ].join(t("ui.common.separators.bullet"))}
              </span>
              <DomainLink to="/mieter" search={{ buildingId }}>
                {t("ui.navigation.tenants")}
              </DomainLink>
              <DomainLink
                to="/zaehler"
                search={{ buildingId, unitId: undefined, type: undefined }}
              >
                {t("ui.navigation.meters")}
              </DomainLink>
            </span>
          }
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild={true}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("ui.common.a11y.more")}
                >
                  <RiMoreLine />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => deletion.request(building)}
                >
                  <RiDeleteBinLine />
                  {t("ui.buildings.actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <div className="space-y-5">
          <MiniKpiRow
            columns={3}
            items={[
              {
                label: t("ui.navigation.units"),
                value: building.unitsCount,
              },
              {
                label: t("ui.units.fields.area"),
                value: t("ui.common.measures.sqm", {
                  value: formatNumber(totalArea, 2),
                }),
              },
              {
                label: t("ui.buildings.activeTenants"),
                value: building.activeTenantsCount,
              },
            ]}
          />

          <div>
            <BuildingBaseCard
              building={building}
              onEdit={() => setSheetOpen(true)}
            />

            <BuildingUnitsCard units={unitRows} buildingId={buildingId} />
          </div>
        </div>
      </div>

      {sheetOpen ? (
        <BuildingSheet
          mode="edit"
          defaultValues={{
            name: building.name,
            addressStreet: building.addressStreet,
            addressPostalCode: building.addressPostalCode,
            addressCity: building.addressCity,
          }}
          onSubmit={async (values) => {
            await updateBuilding.mutateAsync(values);

            await router.invalidate();
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      {deletion.dialog}
    </>
  );
};
