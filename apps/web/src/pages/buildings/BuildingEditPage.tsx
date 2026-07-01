import { type BuildingCreateDto, formatNumber } from "@einfachvermieter/shared";
import { RiDeleteBinLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ActionLink } from "../../components/common/ActionLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { HeroBand } from "../../components/common/HeroBand";
import { InfoCard } from "../../components/common/InfoCard";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { api } from "../../lib/api";
import type { Building } from "../../lib/buildings";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { unitsOverviewQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { BuildingForm } from "./BuildingForm";

const routeApi = getRouteApi("/gebaeude/$buildingId");

export const BuildingEditPage = () => {
  const { buildingId } = routeApi.useParams();
  const building = routeApi.useLoaderData();
  const navigate = useNavigate();

  const goBack = useGoBack("/gebaeude");

  const { data: units } = useQuery({
    ...unitsOverviewQueryOptions({ page: 0, pageSize: 1000, buildingId }),
    enabled: building !== null,
  });

  const updateBuilding = useCrudMutation({
    mutationFn: (dto: BuildingCreateDto) =>
      api.patch<Building>(`/buildings/${buildingId}`, dto),
    invalidateKeys: [["buildings"], ["building", buildingId]],
    onSuccess: goBack,
  });

  const deletion = useDeleteResource<Building>({
    endpoint: (target) => `/buildings/${target.id}`,
    invalidateKey: ["buildings"],
    title: t("ui.buildings.confirmDelete"),
    describe: (target) =>
      t("ui.buildings.confirmDeleteWithUnits", { name: target.name }),
    onDeleted: () => navigate({ to: "/gebaeude" }),
  });

  if (!building) {
    return (
      <EntityNotFound
        title={t("ui.buildings.notFound.title")}
        description={t("ui.buildings.notFound.description")}
        to="/gebaeude"
      />
    );
  }

  const totalArea =
    units?.items.reduce((sum, unit) => sum + unit.areaSqm, 0) ?? 0;

  return (
    <div className="pb-24">
      <HeroBand
        tile={<InitialsAvatar name={building.name} size={64} />}
        eyebrow={t("ui.buildings.editEyebrow")}
        title={building.name}
        meta={[
          building.addressStreet,
          `${building.addressPostalCode} ${building.addressCity}`,
        ].join(t("ui.common.separators.bullet"))}
        stats={[
          { label: t("ui.navigation.units"), value: building.unitsCount },
          {
            label: t("ui.units.fields.area"),
            value: `${formatNumber(totalArea, 2)} m²`,
          },
          {
            label: t("ui.navigation.tenants"),
            value: building.activeTenantsCount,
          },
        ]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <BuildingForm
          mode="edit"
          defaultValues={{
            name: building.name,
            addressStreet: building.addressStreet,
            addressPostalCode: building.addressPostalCode,
            addressCity: building.addressCity,
          }}
          onSubmit={async (values) => {
            await updateBuilding.mutateAsync(values);
          }}
          onCancel={goBack}
        />

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <InfoCard title={t("ui.common.infoCards.links")}>
            <ActionLink
              icon={domainVisuals.units.icon}
              iconBackground={domainVisuals.units.accent}
              onClick={() =>
                navigate({ to: "/wohnungen", search: { buildingId } })
              }
            >
              {t("ui.navigation.units")}
            </ActionLink>
            <ActionLink
              icon={domainVisuals.meters.icon}
              iconBackground={domainVisuals.meters.accent}
              onClick={() =>
                navigate({
                  to: "/zaehler",
                  search: { buildingId, unitId: undefined, type: undefined },
                })
              }
            >
              {t("ui.navigation.meters")}
            </ActionLink>
            <ActionLink
              icon={domainVisuals.tenants.icon}
              iconBackground={domainVisuals.tenants.accent}
              onClick={() =>
                navigate({ to: "/mieter", search: { buildingId } })
              }
            >
              {t("ui.navigation.tenants")}
            </ActionLink>
          </InfoCard>

          <InfoCard title={t("ui.common.infoCards.actions")}>
            <ActionLink
              icon={RiDeleteBinLine}
              iconBackground="var(--color-rose-400)"
              danger={true}
              onClick={() => deletion.request(building)}
            >
              {t("ui.buildings.actions.delete")}
            </ActionLink>
          </InfoCard>
        </div>
      </div>

      {deletion.dialog}
    </div>
  );
};
