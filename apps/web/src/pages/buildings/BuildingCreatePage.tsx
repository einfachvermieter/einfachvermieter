import type { BuildingCreateDto } from "@einfachvermieter/shared";
import { RiBuilding4Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { FormPage } from "../../components/common/FormPage";
import { IconTile } from "../../components/common/IconTile";
import { InfoCard } from "../../components/common/InfoCard";
import { api } from "../../lib/api";
import { type Building, buildingsQueryOptions } from "../../lib/buildings";
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
  const { data: buildings } = useQuery(buildingsQueryOptions);

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
      aside={
        <InfoCard
          title={t("ui.common.infoCards.atAGlance")}
          rows={[
            {
              label: t("ui.navigation.buildings"),
              value: buildings?.length ?? t("ui.common.emptyValue"),
            },
            {
              label: t("ui.navigation.units"),
              value: buildings
                ? buildings.reduce((sum, entry) => sum + entry.unitsCount, 0)
                : t("ui.common.emptyValue"),
            },
            {
              label: t("ui.navigation.tenants"),
              value: buildings
                ? buildings.reduce(
                    (sum, entry) => sum + entry.activeTenantsCount,
                    0,
                  )
                : t("ui.common.emptyValue"),
            },
          ]}
        />
      }
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
