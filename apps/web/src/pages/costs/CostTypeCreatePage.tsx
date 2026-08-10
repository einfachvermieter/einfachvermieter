import { BuildingContextCard } from "../../components/common/BuildingContextCard";
import { FormPage } from "../../components/common/FormPage";
import { IconTile } from "../../components/common/IconTile";
import { FormSkeleton } from "../../components/FormSkeleton";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import type { CostType } from "../../lib/costs";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { CostTypeForm } from "./components/baseData/CostTypeForm";
import {
  ALLOCATION_KEY_NONE,
  type CostTypeSubmitValues,
  LABOR_CATEGORY_NONE,
} from "./components/baseData/costTypeForm.schema";

export const CostTypeCreatePage = () => {
  const { buildingId, building } = useActiveBuilding();

  const goBack = useGoBack("/kostenarten");

  const createCostType = useCrudMutation({
    mutationFn: (dto: CostTypeSubmitValues) =>
      api.post<CostType>("/costs/types", dto),
    invalidateKeys: [["costTypes"], ["stats"]],
    onSuccess: goBack,
  });

  return (
    <FormPage
      tile={
        <IconTile
          icon={domainVisuals.costTypes.icon}
          size={44}
          background={gradients.notes}
        />
      }
      title={t("ui.costs.typeCreateTitle")}
      aside={<BuildingContextCard building={building} />}
    >
      {buildingId ? (
        <CostTypeForm
          mode="create"
          defaultValues={{
            buildingId,
            name: "",
            category: "operating",
            defaultAllocationKey: ALLOCATION_KEY_NONE,
            laborCostCategory: LABOR_CATEGORY_NONE,
            co2Tracked: false,
            isMeteringServiceCost: false,
          }}
          onSubmit={async (values) => {
            await createCostType.mutateAsync(values);
          }}
          onCancel={goBack}
        />
      ) : (
        <FormSkeleton rows={4} />
      )}
    </FormPage>
  );
};
