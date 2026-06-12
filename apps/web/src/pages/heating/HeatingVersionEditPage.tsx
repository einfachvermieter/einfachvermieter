import {
  type HeatingFormValues,
  type HeatingSettings,
  heatingFormSchema,
  heatingSettingsToFormValues,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { FormPage } from "../../components/common/FormPage";
import { FormSkeleton } from "../../components/FormSkeleton";
import { type Building, buildingsQueryOptions } from "../../lib/buildings";
import {
  heatingIdentityLabel,
  heatingSettingsByIdQueryOptions,
  updateHeatingSettings,
} from "../../lib/heating";
import { t } from "../../lib/i18n";
import { type Meter, metersOverviewQueryOptions } from "../../lib/meters";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { ExternalHeatingEntriesSection } from "./components/externalEntries/ExternalHeatingEntriesSection";
import { HeatingForm } from "./HeatingForm";

export const HeatingVersionEditPage = () => {
  const { id } = useParams({ strict: false }) as { id: string };

  const versionQuery = useQuery(heatingSettingsByIdQueryOptions(id));
  const version = versionQuery.data;
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const buildingId = version?.buildingId;
  const building = buildings?.find((entry) => entry.id === buildingId);

  const { data: metersResult } = useQuery({
    ...metersOverviewQueryOptions({
      page: 0,
      pageSize: 500,
      buildingId: buildingId ?? undefined,
    }),
    enabled: Boolean(buildingId),
  });

  const onDone = useGoBack("/heizkosten", { search: { buildingId } });

  if (versionQuery.isError) {
    return (
      <EntityNotFound
        title={t("ui.heating.versions.notFound.title")}
        description={t("ui.heating.versions.notFound.description")}
        to="/heizkosten"
      />
    );
  }

  if (buildings && version && !building) {
    return (
      <EntityNotFound
        title={t("ui.buildings.notFound.title")}
        description={t("ui.buildings.notFound.description")}
        to="/heizkosten"
      />
    );
  }

  if (!version || !buildings || !building || !metersResult) {
    return <FormSkeleton rows={4} />;
  }

  const hotWaterMeterCandidates = metersResult.items.filter(
    (meter) =>
      meter.type === "heat_meter" &&
      meter.unitId === null &&
      meter.role !== "unit" &&
      meter.role !== "virtual_difference" &&
      meter.costAllocationMode === "heating_cost_bill",
  );

  return (
    <HeatingVersionEditView
      buildings={buildings}
      building={building}
      version={version}
      hotWaterMeterCandidates={hotWaterMeterCandidates}
      onDone={onDone}
    />
  );
};

const HeatingVersionEditView = ({
  buildings,
  building,
  version,
  hotWaterMeterCandidates,
  onDone,
}: {
  buildings: Building[];
  building: Building;
  version: HeatingSettings;
  hotWaterMeterCandidates: Meter[];
  onDone: () => void;
}) => {
  const form = useForm<HeatingFormValues>({
    resolver: zodResolver(heatingFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: heatingSettingsToFormValues(version),
  });

  const update = useCrudMutation({
    mutationFn: (dto: Parameters<typeof updateHeatingSettings>[2]) =>
      updateHeatingSettings(building.id, version.id, dto),
    invalidateKeys: [["heating"], ["heating", "version", version.id]],
    onSuccess: onDone,
  });

  const isExternal = form.watch("mode") === "external";

  return (
    <FormPage title={heatingIdentityLabel(version)}>
      <HeatingForm
        form={form}
        buildings={buildings}
        buildingFieldDisabled={true}
        hotWaterMeterCandidates={hotWaterMeterCandidates}
        onSubmit={async (dto) => {
          await update.mutateAsync(dto);
        }}
        onCancel={onDone}
      />
      {isExternal ? (
        <ExternalHeatingEntriesSection buildingId={building.id} />
      ) : null}
    </FormPage>
  );
};
