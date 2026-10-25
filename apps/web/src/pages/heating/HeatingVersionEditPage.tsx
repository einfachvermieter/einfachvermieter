import {
  formatDate,
  type HeatingFormValues,
  type HeatingSettings,
  heatingFormToDto,
  heatingSettingsToFormValues,
  todayIso,
} from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageDeleteAction } from "@/components/common/PageDeleteAction";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Badge } from "../../components/ui/Badge";
import { useAdoptBuilding } from "../../lib/activeBuilding";
import { buildingsQueryOptions } from "../../lib/buildings";
import { formatPeriod } from "../../lib/format";
import {
  heatingSettingsByIdQueryOptions,
  heatingSettingsListQueryOptions,
  previousBaseMethodOf,
  updateHeatingSettings,
} from "../../lib/heating";
import { t } from "../../lib/i18n";
import { metersOverviewQueryOptions } from "../../lib/meters";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { ExternalHeatingEntriesCard } from "./cards/ExternalHeatingEntriesCard";
import { HeatingBillingCard } from "./cards/HeatingBillingCard";
import { HeatingInstallationCard } from "./cards/HeatingInstallationCard";
import { HeatingProrationCard } from "./cards/HeatingProrationCard";
import { hotWaterMeterCandidatesOf } from "./hotWaterMeters";
import { HeatingBillingSheet } from "./sheets/HeatingBillingSheet";
import { HeatingInstallationSheet } from "./sheets/HeatingInstallationSheet";
import { HeatingProrationSheet } from "./sheets/HeatingProrationSheet";

const routeApi = getRouteApi("/heizkosten/$id");

/**
 * Version aktiv zum Stichtag: validFrom <= heute <= validTo (bzw. offen)
 */
const isVersionActive = (version: HeatingSettings, today: string): boolean =>
  version.validFrom <= today &&
  (version.validTo === null || version.validTo >= today);

/**
 * Heizkosten-Ansicht: Kopf, Abrechnung, Aufteilung und Heizungsanlage als
 * Abschnitte, im externen Modus zusätzlich die Endbeträge je Wohnung. Ohne
 * Heizkostenabrechnung bleibt nur der Abschnitt der Abrechnung
 */
export const HeatingVersionEditPage = () => {
  const { id } = routeApi.useParams();

  // Aus der Query statt aus den Loader-Daten: nach dem Speichern im Sheet
  // steht der neue Stand sofort in der Ansicht.
  const versionQuery = useQuery(heatingSettingsByIdQueryOptions(id));
  const version = versionQuery.data;

  // Beim Direkteinstieg das Gebäude des Objekts übernehmen
  useAdoptBuilding(version?.buildingId);
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const building = buildings?.find((entry) => entry.id === version?.buildingId);

  const { data: metersResult } = useQuery({
    ...metersOverviewQueryOptions({
      page: 0,
      pageSize: 500,
      buildingId: version?.buildingId,
    }),
    enabled: version !== undefined,
  });

  const { data: versions } = useQuery({
    ...heatingSettingsListQueryOptions(version?.buildingId ?? ""),
    enabled: version !== undefined,
  });

  const navigate = useNavigate();
  const router = useRouter();
  const [sheet, setSheet] = useState<
    "billing" | "proration" | "installation" | null
  >(null);

  const update = useCrudMutation({
    mutationFn: (values: HeatingFormValues) =>
      updateHeatingSettings(values.buildingId, id, heatingFormToDto(values)),
    invalidateKeys: [["heating"], ["heating", "version", id]],
  });

  const deletion = useDeleteResource<HeatingSettings>({
    endpoint: (target) =>
      `/buildings/${target.buildingId}/heating/${target.id}`,
    invalidateKeys: [["heating"]],
    title: t("ui.heating.versions.confirmDelete"),
    describe: (target) =>
      t("ui.heating.versions.confirmDeleteMessage", {
        building: building?.name ?? "",
        period: formatPeriod(target.validFrom, target.validTo),
      }),
    onDeleted: () =>
      navigate({
        to: "/heizkosten",
        search: { buildingId: version?.buildingId },
      }),
  });

  if (
    versionQuery.isError ||
    (version === undefined && !versionQuery.isLoading)
  ) {
    return (
      <EntityNotFound
        title={t("ui.heating.versions.notFound.title")}
        description={t("ui.heating.versions.notFound.description")}
        to="/heizkosten"
      />
    );
  }

  if (!(version && buildings && metersResult && versions)) {
    return (
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon domain="heating" />}
          title=""
          loading={true}
        />
        <FormSkeleton rows={4} />
      </div>
    );
  }

  const isInternal = version.mode === "internal";
  const formValues = heatingSettingsToFormValues(version);
  const hotWaterMeterCandidates = hotWaterMeterCandidatesOf(metersResult.items);
  const active = isVersionActive(version, todayIso());

  const save = async (next: HeatingFormValues) => {
    await update.mutateAsync(next);
    await router.invalidate();
    setSheet(null);
  };

  return (
    <>
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon domain="heating" />}
          title={t("ui.heating.identityTitle", {
            validFrom: formatDate(version.validFrom),
          })}
          sub={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
              {isInternal ? (
                <span>
                  {t(`ui.heating.heatingTypes.${version.heatingType}`)}
                </span>
              ) : (
                <span>{t(`ui.heating.modes.${version.mode}`)}</span>
              )}
              {isInternal ? (
                <span>{t(`ui.heating.fuelTypes.${version.fuelType}`)}</span>
              ) : null}
              <Badge appearance="dot" variant={active ? "ok" : "neutral"}>
                {active
                  ? t("ui.heating.versions.statusActive")
                  : t("ui.heating.versions.statusArchived")}
              </Badge>
            </span>
          }
          action={
            <PageDeleteAction onClick={() => deletion.request(version)} />
          }
        />

        <div className="space-y-5">
          <div>
            <HeatingBillingCard
              version={version}
              onEdit={() => setSheet("billing")}
            />

            {version.mode === "none" ? null : (
              <HeatingProrationCard
                version={version}
                onEdit={() => setSheet("proration")}
              />
            )}

            {isInternal ? (
              <HeatingInstallationCard
                version={version}
                hotWaterMeter={metersResult.items.find(
                  (meter) => meter.id === version.hotWaterMeterId,
                )}
                onEdit={() => setSheet("installation")}
              />
            ) : null}
            {version.mode === "external" ? (
              <ExternalHeatingEntriesCard buildingId={version.buildingId} />
            ) : null}
          </div>
        </div>
      </div>

      {sheet === "billing" ? (
        <HeatingBillingSheet
          defaultValues={formValues}
          previousBaseMethod={previousBaseMethodOf(versions, version.validFrom)}
          onSubmit={save}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === "proration" ? (
        <HeatingProrationSheet
          defaultValues={formValues}
          onSubmit={save}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === "installation" ? (
        <HeatingInstallationSheet
          defaultValues={formValues}
          hotWaterMeterCandidates={hotWaterMeterCandidates}
          onSubmit={save}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {deletion.dialog}
    </>
  );
};
