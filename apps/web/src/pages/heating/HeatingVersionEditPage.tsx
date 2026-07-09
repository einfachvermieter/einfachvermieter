import {
  formatDate,
  type HeatingFormValues,
  type HeatingSettings,
  heatingFormSchema,
  heatingSettingsToFormValues,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiDeleteBinLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { ActionLink } from "../../components/common/ActionLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { HeroBand } from "../../components/common/HeroBand";
import { IconTile } from "../../components/common/IconTile";
import { InfoCard } from "../../components/common/InfoCard";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Badge } from "../../components/ui/Badge";
import { type Building, buildingsQueryOptions } from "../../lib/buildings";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import {
  heatingSettingsByIdQueryOptions,
  updateHeatingSettings,
} from "../../lib/heating";
import { t } from "../../lib/i18n";
import { type Meter, metersOverviewQueryOptions } from "../../lib/meters";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { ExternalHeatingEntriesSection } from "./components/externalEntries/ExternalHeatingEntriesSection";
import { HeatingForm } from "./HeatingForm";

/** Version aktiv zum Stichtag: validFrom <= heute <= validTo (bzw. offen) */
const isVersionActive = (version: HeatingSettings, today: string): boolean =>
  version.validFrom <= today &&
  (version.validTo === null || version.validTo >= today);

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
  const navigate = useNavigate();
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

  const deletion = useDeleteResource<HeatingSettings>({
    endpoint: () => `/buildings/${building.id}/heating/${version.id}`,
    invalidateKey: ["heating"],
    title: t("ui.heating.versions.confirmDelete"),
    describe: (target) =>
      t("ui.heating.versions.confirmDeleteMessage", {
        from: formatDate(target.validFrom),
        to: target.validTo
          ? formatDate(target.validTo)
          : t("ui.common.emptyValue"),
      }),
    onDeleted: onDone,
  });

  const isExternal = form.watch("mode") === "external";
  const isInternal = version.mode === "internal";
  const active = isVersionActive(version, todayIso());
  const dash = t("ui.common.emptyValue");
  const sharesText = isInternal
    ? `${version.baseSharePercent} / ${version.consumptionSharePercent}`
    : dash;
  const fuelText = isInternal
    ? t(`ui.heating.fuelTypes.${version.fuelType}`)
    : dash;

  return (
    <div className="pb-24">
      <HeroBand
        tile={
          <IconTile
            icon={domainVisuals.heating.icon}
            size={64}
            background={gradients.heating}
          />
        }
        eyebrow={t("ui.heating.editTitle")}
        title={t("ui.heating.heroTitle", {
          validFrom: formatDate(version.validFrom),
        })}
        meta={building.name}
        stats={[
          { label: t("ui.heating.versions.columns.split"), value: sharesText },
          { label: t("ui.heating.fields.fuelType"), value: fuelText },
          {
            label: t("ui.heating.versions.columns.status"),
            value: active
              ? t("ui.heating.versions.statusActive")
              : t("ui.heating.detail.statusInactive"),
          },
        ]}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] *:min-w-0">
        <div>
          <HeatingForm
            form={form}
            buildings={buildings}
            buildingFieldDisabled={true}
            hotWaterMeterCandidates={hotWaterMeterCandidates}
            savedAt={formatDate(version.updatedAt.slice(0, 10))}
            onSubmit={async (dto) => {
              await update.mutateAsync(dto);
            }}
            onCancel={onDone}
          />
          {isExternal ? (
            <ExternalHeatingEntriesSection buildingId={building.id} />
          ) : null}
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-24">
          <InfoCard title={t("ui.common.infoCards.links")}>
            <ActionLink
              icon={domainVisuals.meters.icon}
              iconBackground={domainVisuals.meters.accent}
              onClick={() =>
                navigate({
                  to: "/zaehler",
                  search: {
                    buildingId: building.id,
                    unitId: undefined,
                    type: undefined,
                  },
                })
              }
            >
              {t("ui.heating.detail.openMeters")}
            </ActionLink>
            <ActionLink
              icon={domainVisuals.statements.icon}
              iconBackground={domainVisuals.statements.accent}
              onClick={() => navigate({ to: "/abrechnungen" })}
            >
              {t("ui.heating.detail.openStatements")}
            </ActionLink>
          </InfoCard>

          <InfoCard
            title={t("ui.common.infoCards.details")}
            rows={[
              {
                label: t("ui.heating.detail.co2Pill"),
                value: isInternal ? (
                  <Badge variant={version.co2CostShareEnabled ? "ok" : "slate"}>
                    {version.co2CostShareEnabled
                      ? t("ui.heating.detail.co2Active")
                      : t("ui.heating.detail.co2Off")}
                  </Badge>
                ) : (
                  dash
                ),
              },
            ]}
          />

          <InfoCard title={t("ui.common.infoCards.actions")}>
            <ActionLink
              icon={RiDeleteBinLine}
              iconBackground="var(--color-rose-400)"
              danger={true}
              onClick={() => deletion.request(version)}
            >
              {t("ui.heating.detail.deleteAction")}
            </ActionLink>
          </InfoCard>
        </div>
      </div>

      {deletion.dialog}
    </div>
  );
};
