import { RiPriceTag3Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { FormPage } from "../../components/common/FormPage";
import { FormSkeleton } from "../../components/FormSkeleton";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { type CostType, costTypeQueryOptions } from "../../lib/costs";
import { t } from "../../lib/i18n";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { CostTypeForm } from "./components/baseData/CostTypeForm";
import {
  ALLOCATION_KEY_NONE,
  type CostTypeFormValues,
  type CostTypeSubmitValues,
  costTypeAllocationKeySchema,
  LABOR_CATEGORY_NONE,
} from "./components/baseData/costTypeForm.schema";

const routeApi = getRouteApi("/kostenarten/$costTypeId");

const toFormValues = (costType: CostType): CostTypeFormValues => {
  // Verteilerschlüssel, die das Formular nicht abbildet (z. B. das noch nicht
  // implementierte `per_consumption_kwh`), fallen auf "kein Schlüssel" zurück.
  const allocationKey = costTypeAllocationKeySchema.safeParse(
    costType.defaultAllocationKey ?? ALLOCATION_KEY_NONE,
  );

  return {
    buildingId: costType.buildingId,
    name: costType.name,
    category: costType.category,
    defaultAllocationKey: allocationKey.success
      ? allocationKey.data
      : ALLOCATION_KEY_NONE,
    laborCostCategory: costType.laborCostCategory ?? LABOR_CATEGORY_NONE,
    co2Tracked: costType.co2Tracked,
  };
};

export const CostTypeEditPage = () => {
  const { costTypeId } = routeApi.useParams();

  const { data: buildings } = useQuery(buildingsQueryOptions);
  const costTypeQuery = useQuery(costTypeQueryOptions(costTypeId));

  const goBack = useGoBack("/kostenarten");

  const updateCostType = useCrudMutation({
    mutationFn: ({ buildingId: _ignored, ...dto }: CostTypeSubmitValues) =>
      api.patch<CostType>(`/costs/types/${costTypeId}`, dto),
    invalidateKeys: [["costTypes"], ["costType", costTypeId]],
    onSuccess: goBack,
  });

  if (
    costTypeQuery.isError ||
    (costTypeQuery.data === undefined && !costTypeQuery.isLoading)
  ) {
    return (
      <EntityNotFound
        title={t("ui.costs.notFound.title")}
        description={t("ui.costs.notFound.description")}
        to="/kostenarten"
      />
    );
  }

  if (!buildings || !costTypeQuery.data) {
    return <FormSkeleton rows={4} />;
  }

  const costType = costTypeQuery.data;

  return (
    <FormPage icon={<RiPriceTag3Line />} title={costType.name}>
      <CostTypeForm
        mode="edit"
        buildings={buildings}
        defaultValues={toFormValues(costType)}
        onSubmit={async (values) => {
          await updateCostType.mutateAsync(values);
        }}
        onCancel={goBack}
      />
    </FormPage>
  );
};
