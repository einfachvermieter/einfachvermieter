import { formatDate, type MeterCreateDto } from "@einfachvermieter/shared";
import { RiDeleteBinLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ActionLink } from "../../components/common/ActionLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { InfoCard } from "../../components/common/InfoCard";
import { FormSkeleton } from "../../components/FormSkeleton";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
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
  const { data: buildings } = useQuery(buildingsQueryOptions);
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
    invalidateKey: ["meters"],
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

  if (!meter || !buildings || !units || !costTypes) {
    return <FormSkeleton rows={4} />;
  }

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
    <div className="pb-24">
      <MeterHero meterId={meterId} eyebrow={t("ui.meters.editTitle")} />

      <MeterDetailHeader meterId={meterId} active="stammdaten" />

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <MeterForm
          mode="edit"
          buildings={buildings}
          units={units}
          costTypes={costTypes}
          defaultValues={meterToFormValues(meter)}
          costAllocationModeLocked={meter.costAllocationModeLocked}
          currentMeterId={meter.id}
          savedAt=""
          onSubmit={async (values) => {
            await updateMeter.mutateAsync(values);
          }}
          onCancel={goBack}
        />

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <InfoCard title={t("ui.common.infoCards.links")}>
            {unit ? (
              <ActionLink
                icon={domainVisuals.units.icon}
                iconBackground={domainVisuals.units.accent}
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
                    iconBackground={domainVisuals.heating.accent}
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
                    iconBackground={domainVisuals.costTypes.accent}
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
              iconBackground="var(--color-rose-400)"
              danger={true}
              onClick={() => deletion.request(meter)}
            >
              {t("ui.meters.detail.deleteAction")}
            </ActionLink>
          </InfoCard>
        </div>
      </div>

      {deletion.dialog}
    </div>
  );
};
