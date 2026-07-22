import {
  emptyHeatingFormValues,
  type HeatingFormValues,
  heatingFormSchema,
  heatingSettingsToFormValues,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { FormPage } from "../../components/common/FormPage";
import { IconTile } from "../../components/common/IconTile";
import { FormSkeleton } from "../../components/FormSkeleton";
import { type Building, buildingsQueryOptions } from "../../lib/buildings";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import {
  createHeatingSettings,
  heatingSettingsListQueryOptions,
} from "../../lib/heating";
import { t } from "../../lib/i18n";
import { metersOverviewQueryOptions } from "../../lib/meters";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { HeatingForm } from "./HeatingForm";

const routeApi = getRouteApi("/heizkosten/neu");

export const HeatingVersionCreatePage = () => {
  const { buildingId: preselected } = routeApi.useSearch();
  const { data: buildings } = useQuery(buildingsQueryOptions);

  const matching = buildings?.find((building) => building.id === preselected);
  const initialBuildingId = matching?.id ?? buildings?.[0]?.id ?? "";

  return (
    <FormPage
      tile={
        <IconTile
          icon={domainVisuals.heating.icon}
          size={44}
          background={gradients.heating}
        />
      }
      title={t("ui.heating.versions.createTitle")}
    >
      {buildings && buildings.length > 0 ? (
        <HeatingVersionCreateView
          key={initialBuildingId}
          buildings={buildings}
          initialBuildingId={initialBuildingId}
        />
      ) : (
        <FormSkeleton rows={4} />
      )}
    </FormPage>
  );
};

const HeatingVersionCreateView = ({
  buildings,
  initialBuildingId,
}: {
  buildings: Building[];
  initialBuildingId: string;
}) => {
  const form = useForm<HeatingFormValues>({
    resolver: zodResolver(heatingFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: emptyHeatingFormValues(initialBuildingId, todayIso()),
  });

  const watchedBuildingId = form.watch("buildingId");

  const { data: versions } = useQuery({
    ...heatingSettingsListQueryOptions(watchedBuildingId),
    enabled: Boolean(watchedBuildingId),
  });
  const { data: metersResult } = useQuery({
    ...metersOverviewQueryOptions({
      page: 0,
      pageSize: 500,
      buildingId: watchedBuildingId,
    }),
    enabled: Boolean(watchedBuildingId),
  });

  // Wenn der User das Gebäude wechselt und es bereits Versionen für das
  // neue Gebäude gibt, übernehmen wir die jüngste als Vorlage, analog
  // zum Erst-Aufruf (Reduziert Tipparbeit, validFrom bleibt heute).
  useEffect(() => {
    if (!versions || versions.length === 0) {
      return;
    }

    const currentValues = form.getValues();
    if (currentValues.buildingId !== watchedBuildingId) {
      return;
    }

    const [latest] = versions;
    if (!latest) {
      return;
    }

    const template = heatingSettingsToFormValues(latest);
    form.reset({
      ...template,
      validFrom: currentValues.validFrom || todayIso(),
      validTo: "",
    });
  }, [versions, watchedBuildingId, form]);

  const goBack = useGoBack("/heizkosten", {
    search: { buildingId: watchedBuildingId || undefined },
  });

  const create = useCrudMutation({
    mutationFn: (variables: {
      buildingId: string;
      dto: Parameters<typeof createHeatingSettings>[1];
    }) => createHeatingSettings(variables.buildingId, variables.dto),
    invalidateKeys: [["heating"]],
    onSuccess: goBack,
  });

  const hotWaterMeterCandidates = (metersResult?.items ?? []).filter(
    (meter) =>
      meter.type === "heat_meter" &&
      meter.unitId === null &&
      meter.role !== "unit" &&
      meter.role !== "virtual_difference" &&
      meter.costAllocationMode === "heating_cost_bill",
  );

  return metersResult ? (
    <HeatingForm
      form={form}
      buildings={buildings}
      hotWaterMeterCandidates={hotWaterMeterCandidates}
      onSubmit={async (dto) => {
        await create.mutateAsync({
          buildingId: form.getValues("buildingId"),
          dto,
        });
      }}
      onCancel={goBack}
    />
  ) : (
    <FormSkeleton rows={4} />
  );
};
