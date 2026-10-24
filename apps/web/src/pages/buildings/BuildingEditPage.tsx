import { type BuildingCreateDto, formatNumber } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageDeleteAction } from "@/components/common/PageDeleteAction";
import { DomainLink } from "../../components/common/DomainLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { useAdoptBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { type Building, buildingQueryOptions } from "../../lib/buildings";
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

  // Beim Direkteinstieg das angezeigte Gebäude aktiv setzen
  useAdoptBuilding(building?.id);

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
      t("ui.buildings.confirmDeleteQuestion", { name: target.name }),
    hint: t("ui.buildings.confirmDeleteHint"),
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
          tile={<PageHeaderIcon domain="buildings" />}
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
          tile={<PageHeaderIcon domain="buildings" />}
          title={building.name}
          sub={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
              <span>
                {[
                  building.addressStreet,
                  `${building.addressPostalCode} ${building.addressCity}`,
                ].join(t("ui.common.separators.comma"))}
              </span>
              <span>
                {t("ui.units.sub.count", { count: building.unitsCount })}
              </span>
              <span>
                {t("ui.common.measures.sqm", {
                  value: formatNumber(totalArea, 2),
                })}
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
            <PageDeleteAction onClick={() => deletion.request(building)} />
          }
        />

        <div className="space-y-5">
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
