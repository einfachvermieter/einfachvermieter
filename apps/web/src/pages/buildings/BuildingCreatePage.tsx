import type { BuildingCreateDto } from "@einfachvermieter/shared";
import { RiBuilding4Line } from "@remixicon/react";
import { FormPage } from "../../components/common/FormPage";
import { IconTile } from "../../components/common/IconTile";
import { api } from "../../lib/api";
import type { Building } from "../../lib/buildings";
import { gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { BuildingForm } from "./BuildingForm";

const defaultValues: BuildingCreateDto = {
  name: "",
  addressStreet: "",
  addressPostalCode: "",
  addressCity: "",
};

export const BuildingCreatePage = () => {
  const goBack = useGoBack("/gebaeude");

  const createBuilding = useCrudMutation({
    mutationFn: (dto: BuildingCreateDto) =>
      api.post<Building>("/buildings", dto),
    invalidateKeys: [["buildings"], ["stats"]],
    onSuccess: goBack,
  });

  return (
    <FormPage
      tile={
        <IconTile
          icon={RiBuilding4Line}
          size={44}
          background={gradients.buildings}
        />
      }
      title={t("ui.buildings.createTitle")}
    >
      <BuildingForm
        mode="create"
        defaultValues={defaultValues}
        onSubmit={async (values) => {
          await createBuilding.mutateAsync(values);
        }}
        onCancel={goBack}
      />
    </FormPage>
  );
};
