import { formatDate, type MeterCreateDto } from "@einfachvermieter/shared";
import { RiDeleteBinLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ActionLink } from "../../components/common/ActionLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { InfoCard } from "../../components/common/InfoCard";
import { FormSkeleton } from "../../components/FormSkeleton";
import { api } from "../../lib/api";
import { costTypesQueryOptions } from "../../lib/costs";
import { domainVisuals } from "../../lib/domainVisuals";
import {
  heatingIdentityLabel,
  heatingSettingsListQueryOptions,
} from "../../lib/heating";
import { t } from "../../lib/i18n";
import type { Meter } from "../../lib/meters";
import { meterQueryOptions, readingsQueryOptions } from "../../lib/meters";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { meterToFormValues } from "./components/meterFormHelpers";
import { MeterDetailHeader } from "./MeterDetailHeader";
import { MeterForm } from "./MeterForm";
import { MeterHero } from "./MeterHero";

export const MeterDetailPage = () => {
  const { meterId } = useParams({ strict: false }) as { meterId: string };
  const navigate = useNavigate();

  const meterQuery = useQuery(meterQueryOptions(meterId));
  const meter = meterQuery.data;
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: costTypes } = useQuery(costTypesQueryOptions);
  const { data: readings } = useQuery(readingsQueryOptions(meterId));
  const { data: heatingVersions } = useQuery({
    ...heatingSettingsListQueryOptions(meter?.buildingId ?? ""),
    enabled: meter?.costAllocationMode === "heating_cost_bill",
  });

  const goBack = useGoBack("/zaehler", {
    search: { buildingId: undefined, type: undefined },
  });

  const updateMeter = useCrudMutation({
    mutationFn: ({ buildingId: _ignored, ...dto }: MeterCreateDto) =>
      api.patch<Meter>(`/meters/${meterId}`, dto),
    invalidateKeys: [["meters"], ["meter", meterId]],
    onSuccess: goBack,
  });

  const deletion = useDeleteResource<Meter>({
    endpoint: (target) => `/meters/${target.id}`,
    invalidateKeys: [["meters"]],
    title: t("ui.meters.confirmDelete"),
    describe: (target) =>
      t("ui.meters.confirmDeleteMessage", { label: target.label }),
    onDeleted: goBack,
  });

  if (meterQuery.isError) {
    return (
      <EntityNotFound
        title={t("ui.meters.notFound.title")}
        description={t("ui.meters.notFound.description")}
        to="/zaehler"
      />
    );
  }

  const loaded = meter && units && costTypes;

  return (
    <div className="pb-24">
      <MeterHero meterId={meterId} />

      <MeterDetailHeader meterId={meterId} active="stammdaten" />

      {loaded ? (
        (() => {
          const dash = t("ui.common.emptyValue");
          const [latest] = [...(readings ?? [])].sort((a, b) =>
            b.readingDate.localeCompare(a.readingDate),
          );
          const unit = meter.unitId
            ? units.find((entry) => entry.id === meter.unitId)
            : undefined;
          const assignedCostTypes = costTypes.filter((costType) =>
            meter.costTypeIds.includes(costType.id),
          );
          const [heatingVersion] = heatingVersions ?? [];

          return (
            <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] *:min-w-0">
              <MeterForm
                mode="edit"
                units={units}
                costTypes={costTypes}
                defaultValues={meterToFormValues(meter)}
                costAllocationModeLocked={meter.costAllocationModeLocked}
                currentMeterId={meter.id}
                savedAt={
                  meter.updatedAt
                    ? formatDate(meter.updatedAt.slice(0, 10))
                    : ""
                }
                onSubmit={async (values) => {
                  await updateMeter.mutateAsync(values);
                }}
                onCancel={goBack}
              />

              <div className="flex flex-col gap-6 xl:sticky xl:top-24">
                <InfoCard title={t("ui.common.infoCards.links")}>
                  {unit ? (
                    <ActionLink
                      icon={domainVisuals.units.icon}
                      onClick={() =>
                        navigate({
                          to: "/wohnungen/$unitId",
                          params: { unitId: unit.id },
                        })
                      }
                    >
                      {unit.name}
                    </ActionLink>
                  ) : null}
                  {meter.costAllocationMode === "heating_cost_bill"
                    ? heatingVersion && (
                        <ActionLink
                          icon={domainVisuals.heating.icon}
                          subtitle={heatingIdentityLabel(heatingVersion)}
                          onClick={() =>
                            navigate({
                              to: "/heizkosten/$id",
                              params: { id: heatingVersion.id },
                            })
                          }
                        >
                          {t("ui.meters.detail.heatingConfig")}
                        </ActionLink>
                      )
                    : assignedCostTypes.map((costType) => (
                        <ActionLink
                          key={costType.id}
                          icon={domainVisuals.costTypes.icon}
                          onClick={() =>
                            navigate({
                              to: "/kostenarten/$costTypeId",
                              params: { costTypeId: costType.id },
                            })
                          }
                        >
                          {costType.name}
                        </ActionLink>
                      ))}
                </InfoCard>

                <InfoCard
                  title={t("ui.common.infoCards.details")}
                  rows={[
                    {
                      label: t("ui.meters.detail.lastReadingLabel"),
                      value: latest ? formatDate(latest.readingDate) : dash,
                    },
                  ]}
                />

                <InfoCard title={t("ui.common.infoCards.actions")}>
                  <ActionLink
                    icon={RiDeleteBinLine}
                    danger={true}
                    onClick={() => deletion.request(meter)}
                  >
                    {t("ui.meters.detail.deleteAction")}
                  </ActionLink>
                </InfoCard>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="mt-6">
          <FormSkeleton rows={4} aside={true} />
        </div>
      )}

      {deletion.dialog}
    </div>
  );
};
