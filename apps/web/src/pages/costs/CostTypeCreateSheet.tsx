import { useNavigate } from "@tanstack/react-router";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import type { CostType } from "../../lib/costs";
import { useCrudMutation } from "../../lib/useCrudMutation";
import {
  ALLOCATION_KEY_NONE,
  type CostTypeSubmitValues,
  LABOR_CATEGORY_NONE,
} from "./components/baseData/costTypeForm.schema";
import { CostTypeSheet } from "./sheets/CostTypeSheet";

/**
 * Kostenart anlegen im FormSheet
 */
export const CostTypeCreateSheet = ({ onClose }: { onClose: () => void }) => {
  const { buildingId } = useActiveBuilding();
  const navigate = useNavigate();

  const createCostType = useCrudMutation({
    mutationFn: (dto: CostTypeSubmitValues) =>
      api.post<CostType>("/costs/types", dto),
    invalidateKeys: [["costTypes"], ["stats"]],
  });

  return (
    <CostTypeSheet
      mode="create"
      defaultValues={{
        buildingId: buildingId ?? "",
        name: "",
        category: "operating",
        defaultAllocationKey: ALLOCATION_KEY_NONE,
        laborCostCategory: LABOR_CATEGORY_NONE,
        co2Tracked: false,
        isMeteringServiceCost: false,
      }}
      onSubmit={async (values) => {
        const created = await createCostType.mutateAsync(values);
        // Direkt zur Kostenart; der Routenwechsel schließt das Sheet
        await navigate({
          to: "/kostenarten/$costTypeId",
          params: { costTypeId: created.id },
        });
      }}
      onClose={onClose}
    />
  );
};
