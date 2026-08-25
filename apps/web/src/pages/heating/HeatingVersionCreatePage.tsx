import {
  emptyHeatingFormValues,
  type HeatingFormValues,
  heatingFormSchema,
  heatingSettingsToFormValues,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { BuildingContextCard } from "../../components/common/BuildingContextCard";
import { FormPage } from "../../components/common/FormPage";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { domainVisuals } from "../../lib/domainVisuals";
import {
  createHeatingSettings,
  heatingSettingsListQueryOptions,
} from "../../lib/heating";
import { t } from "../../lib/i18n";
import { type Meter, metersOverviewQueryOptions } from "../../lib/meters";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { HeatingForm } from "./HeatingForm";

export const HeatingVersionCreatePage = () => {
  const { buildingId, building } = useActiveBuilding();

  return (
    <FormPage
      tile={<PageHeaderIcon icon={domainVisuals.heating.icon} />}
      title={t("ui.heating.versions.createTitle")}
      aside={<BuildingContextCard building={building} />}
    >
      {buildingId ? (
        <HeatingVersionCreateView buildingId={buildingId} />
      ) : (
        <FormSkeleton rows={4} />
      )}
    </FormPage>
  );
};

const HeatingVersionCreateView = ({ buildingId }: { buildingId: string }) => {
  const { data: versions } = useQuery(
    heatingSettingsListQueryOptions(buildingId),
  );
  const { data: metersResult } = useQuery(
    metersOverviewQueryOptions({
      page: 0,
      pageSize: 500,
      buildingId,
    }),
  );

  if (!versions || !metersResult) {
    return <FormSkeleton rows={4} />;
  }

  // Gibt es für das Gebäude bereits Versionen, dient die jüngste als
  // Vorlage; die Gültigkeit beginnt heute. Die Werte stehen fest,
  // bevor das Formular initialisiert wird
  const [latest] = versions;
  const defaultValues = latest
    ? {
        ...heatingSettingsToFormValues(latest),
        validFrom: todayIso(),
        validTo: "",
      }
    : emptyHeatingFormValues(buildingId, todayIso());

  return (
    <HeatingVersionCreateForm
      buildingId={buildingId}
      defaultValues={defaultValues}
      meters={metersResult.items}
    />
  );
};

const HeatingVersionCreateForm = ({
  buildingId,
  defaultValues,
  meters,
}: {
  buildingId: string;
  defaultValues: HeatingFormValues;
  meters: Meter[];
}) => {
  const form = useForm<HeatingFormValues>({
    resolver: zodResolver(heatingFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const goBack = useGoBack("/heizkosten", {
    search: { buildingId },
  });

  const create = useCrudMutation({
    mutationFn: (variables: {
      buildingId: string;
      dto: Parameters<typeof createHeatingSettings>[1];
    }) => createHeatingSettings(variables.buildingId, variables.dto),
    invalidateKeys: [["heating"]],
    onSuccess: goBack,
  });

  const hotWaterMeterCandidates = meters.filter(
    (meter) =>
      meter.type === "heat_meter" &&
      meter.unitId === null &&
      meter.role !== "unit" &&
      meter.role !== "virtual_difference" &&
      meter.costAllocationMode === "heating_cost_bill",
  );

  return (
    <HeatingForm
      form={form}
      hotWaterMeterCandidates={hotWaterMeterCandidates}
      onSubmit={async (dto) => {
        await create.mutateAsync({ buildingId, dto });
      }}
      onCancel={goBack}
    />
  );
};
