import type { UnitCreateDto, UnitFormValues } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { FormPage } from "../../components/common/FormPage";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { t } from "../../lib/i18n";
import type { Unit } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { UnitForm } from "./UnitForm";

const routeApi = getRouteApi("/wohnungen/neu");

export const UnitCreatePage = () => {
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { buildingId: preselectedBuildingId } = routeApi.useSearch();

  const matchingBuilding = buildings?.find(
    (building) => building.id === preselectedBuildingId,
  );
  const defaultValues: UnitFormValues = {
    buildingId: matchingBuilding?.id ?? buildings?.[0]?.id ?? "",
    name: "",
    unitNumber: "",
    areaSqm: "",
    heatingAreaSqm: "",
  };

  const goBack = useGoBack("/wohnungen");

  const createUnit = useCrudMutation({
    mutationFn: (dto: UnitCreateDto) => api.post<Unit>("/units", dto),
    invalidateKeys: [["units"], ["stats"]],
    onSuccess: goBack,
  });

  return (
    <FormPage title={t("ui.units.createTitle")}>
      <UnitForm
        key={defaultValues.buildingId}
        mode="create"
        buildings={buildings ?? []}
        defaultValues={defaultValues}
        onSubmit={async (values) => {
          await createUnit.mutateAsync(values);
        }}
        onCancel={goBack}
      />
    </FormPage>
  );
};
