import type { UnitCreateDto } from "@einfachvermieter/shared";
import { useNavigate } from "@tanstack/react-router";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import type { Unit } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { UnitSheet } from "./sheets/UnitSheet";

/**
 * Wohnung anlegen im FormSheet. Speichert sofort und führt auf die neue
 * Wohnung, wo Zähler und Mietvertrag anschließen.
 */
export const UnitCreateSheet = ({ onClose }: { onClose: () => void }) => {
  const { buildingId } = useActiveBuilding();
  const navigate = useNavigate();

  const createUnit = useCrudMutation({
    mutationFn: (dto: UnitCreateDto) => api.post<Unit>("/units", dto),
    invalidateKeys: [["units"], ["stats"]],
  });

  return (
    <UnitSheet
      mode="create"
      defaultValues={{
        buildingId: buildingId ?? "",
        name: "",
        unitNumber: "",
        areaSqm: "",
        heatingAreaSqm: "",
      }}
      onSubmit={async (values) => {
        const created = await createUnit.mutateAsync(values);
        // Direkt zur Wohnung; der Routenwechsel schließt das Sheet
        await navigate({
          to: "/wohnungen/$unitId",
          params: { unitId: created.id },
        });
      }}
      onClose={onClose}
    />
  );
};
