import type { UnitCreateDto, UnitFormValues } from "@einfachvermieter/shared";
import { RiHome4Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { BuildingContextCard } from "../../components/common/BuildingContextCard";
import { FormPage } from "../../components/common/FormPage";
import { IconTile } from "../../components/common/IconTile";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import type { Unit } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { UnitForm } from "./UnitForm";

const routeApi = getRouteApi("/wohnungen/neu");

export const UnitCreatePage = () => {
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { buildingId: preselectedBuildingId } = routeApi.useSearch();

  // Gebäude-Auswahl aus dem Formular, für die Kontext-Karte
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>();

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

  const contextBuilding =
    buildings?.find((building) => building.id === selectedBuildingId) ??
    matchingBuilding ??
    buildings?.[0];

  const goBack = useGoBack("/wohnungen");

  const createUnit = useCrudMutation({
    mutationFn: (dto: UnitCreateDto) => api.post<Unit>("/units", dto),
    invalidateKeys: [["units"], ["stats"]],
    onSuccess: goBack,
  });

  return (
    <FormPage
      tile={
        <IconTile icon={RiHome4Line} size={44} background={gradients.units} />
      }
      title={t("ui.units.createTitle")}
      aside={<BuildingContextCard building={contextBuilding} />}
    >
      <UnitForm
        key={defaultValues.buildingId}
        mode="create"
        buildings={buildings ?? []}
        defaultValues={defaultValues}
        onSubmit={async (values) => {
          await createUnit.mutateAsync(values);
        }}
        onCancel={goBack}
        onBuildingChange={setSelectedBuildingId}
      />
    </FormPage>
  );
};
