import type { BuildingCreateDto } from "@einfachvermieter/shared";
import { useNavigate } from "@tanstack/react-router";
import { api } from "../../lib/api";
import type { Building } from "../../lib/buildings";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { BuildingSheet } from "./sheets/BuildingSheet";

/**
 * Gebäude anlegen im FormSheet
 */
export const BuildingCreateSheet = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();

  const createBuilding = useCrudMutation({
    mutationFn: (dto: BuildingCreateDto) =>
      api.post<Building>("/buildings", dto),
    invalidateKeys: [["buildings"], ["stats"]],
  });

  return (
    <BuildingSheet
      mode="create"
      defaultValues={{
        name: "",
        addressStreet: "",
        addressPostalCode: "",
        addressCity: "",
      }}
      onSubmit={async (values) => {
        const created = await createBuilding.mutateAsync(values);
        // Direkt zum Gebäude; der Routenwechsel schließt das Sheet
        await navigate({
          to: "/gebaeude/$buildingId",
          params: { buildingId: created.id },
        });
      }}
      onClose={onClose}
    />
  );
};
