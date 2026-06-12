import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { FormPage } from "../../components/common/FormPage";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import type { CostType } from "../../lib/costs";
import { t } from "../../lib/i18n";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { CostTypeForm } from "./components/baseData/CostTypeForm";
import {
  ALLOCATION_KEY_NONE,
  type CostTypeFormValues,
  type CostTypeSubmitValues,
  LABOR_CATEGORY_NONE,
} from "./components/baseData/costTypeForm.schema";

const routeApi = getRouteApi("/kostenarten/neu");

export const CostTypeCreatePage = () => {
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { buildingId: preselectedBuildingId } = routeApi.useSearch();

  const matchingBuilding = buildings?.find(
    (building) => building.id === preselectedBuildingId,
  );
  const defaultValues: CostTypeFormValues = {
    buildingId: matchingBuilding?.id ?? buildings?.[0]?.id ?? "",
    name: "",
    category: "operating",
    defaultAllocationKey: ALLOCATION_KEY_NONE,
    laborCostCategory: LABOR_CATEGORY_NONE,
    co2Tracked: false,
  };

  const goBack = useGoBack("/kostenarten");

  const createCostType = useCrudMutation({
    mutationFn: (dto: CostTypeSubmitValues) =>
      api.post<CostType>("/costs/types", dto),
    invalidateKeys: [["costTypes"], ["stats"]],
    onSuccess: goBack,
  });

  return (
    <FormPage title={t("ui.costs.typeCreateTitle")}>
      <CostTypeForm
        key={defaultValues.buildingId}
        mode="create"
        buildings={buildings ?? []}
        defaultValues={defaultValues}
        onSubmit={async (values) => {
          await createCostType.mutateAsync(values);
        }}
        onCancel={goBack}
      />
    </FormPage>
  );
};
