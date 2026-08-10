import { type MeterCreateDto, todayIso } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { BuildingContextCard } from "../../components/common/BuildingContextCard";
import { FormPage } from "../../components/common/FormPage";
import { IconTile } from "../../components/common/IconTile";
import { FormSkeleton } from "../../components/FormSkeleton";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
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
  const { buildingId, building } = useActiveBuilding();
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: costTypes } = useQuery(costTypesQueryOptions);
  const { type: preselectedType } = routeApi.useSearch();

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
      aside={<BuildingContextCard building={building} />}
    >
      {buildingId && units && costTypes ? (
        <MeterForm
          mode="create"
          units={units}
          costTypes={costTypes}
          defaultValues={emptyMeterFormValues(
            buildingId,
            todayIso(),
            preselectedType,
          )}
          onSubmit={async (values) => {
            await createMeter.mutateAsync(values);
          }}
          onCancel={goBack}
        />
      ) : (
        <FormSkeleton rows={4} />
      )}
    </FormPage>
  );
};
