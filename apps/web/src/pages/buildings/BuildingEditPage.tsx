import type { BuildingCreateDto } from "@einfachvermieter/shared";
import { getRouteApi } from "@tanstack/react-router";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { FormPage } from "../../components/common/FormPage";
import { HeroBand } from "../../components/common/HeroBand";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { api } from "../../lib/api";
import type { Building } from "../../lib/buildings";
import { t } from "../../lib/i18n";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { BuildingForm } from "./BuildingForm";

const routeApi = getRouteApi("/gebaeude/$buildingId");

export const BuildingEditPage = () => {
  const { buildingId } = routeApi.useParams();
  const building = routeApi.useLoaderData();

  const goBack = useGoBack("/gebaeude");

  const updateBuilding = useCrudMutation({
    mutationFn: (dto: BuildingCreateDto) =>
      api.patch<Building>(`/buildings/${buildingId}`, dto),
    invalidateKeys: [["buildings"], ["building", buildingId]],
    onSuccess: goBack,
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

  return (
    <FormPage
      head={
        <HeroBand
          tile={<InitialsAvatar name={building.name} size={64} />}
          eyebrow={t("ui.buildings.editEyebrow")}
          title={building.name}
          meta={[
            building.addressStreet,
            `${building.addressPostalCode} ${building.addressCity}`,
          ].join(t("ui.common.separators.bullet"))}
        />
      }
    >
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
    </FormPage>
  );
};
