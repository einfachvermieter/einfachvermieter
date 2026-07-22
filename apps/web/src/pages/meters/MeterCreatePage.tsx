import { type MeterCreateDto, todayIso } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { FormPage } from "../../components/common/FormPage";
import { IconTile } from "../../components/common/IconTile";
import { FormSkeleton } from "../../components/FormSkeleton";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { costTypesQueryOptions } from "../../lib/costs";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import type { Meter } from "../../lib/meters";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { emptyMeterFormValues } from "./components/meterFormHelpers";
import { MeterForm } from "./MeterForm";

const routeApi = getRouteApi("/zaehler/neu");

export const MeterCreatePage = () => {
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: costTypes } = useQuery(costTypesQueryOptions);
  const { buildingId: preselectedBuildingId, type: preselectedType } =
    routeApi.useSearch();

  const goBack = useGoBack("/zaehler", {
    search: { buildingId: undefined, type: undefined },
  });

  const createMeter = useCrudMutation({
    mutationFn: (dto: MeterCreateDto) => api.post<Meter>("/meters", dto),
    invalidateKeys: [["meters"], ["stats"]],
    onSuccess: goBack,
  });

  return (
    <FormPage
      tile={
        <IconTile
          icon={domainVisuals.meters.icon}
          size={44}
          background={gradients.water}
        />
      }
      title={t("ui.meters.createTitle")}
    >
      {buildings && units && costTypes ? (
        (() => {
          const matchingBuilding = buildings.find(
            (building) => building.id === preselectedBuildingId,
          );
          const initialBuildingId =
            matchingBuilding?.id ?? buildings[0]?.id ?? "";
          const today = todayIso();
          const defaultValues = emptyMeterFormValues(
            initialBuildingId,
            today,
            preselectedType,
          );

          return (
            <MeterForm
              key={defaultValues.buildingId}
              mode="create"
              buildings={buildings}
              units={units}
              costTypes={costTypes}
              defaultValues={defaultValues}
              onSubmit={async (values) => {
                await createMeter.mutateAsync(values);
              }}
              onCancel={goBack}
            />
          );
        })()
      ) : (
        <FormSkeleton rows={4} />
      )}
    </FormPage>
  );
};
