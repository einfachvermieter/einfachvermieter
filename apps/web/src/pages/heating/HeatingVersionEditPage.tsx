import {
  formatDate,
  type HeatingFormValues,
  type HeatingSettings,
  heatingFormToDto,
  heatingSettingsToFormValues,
  todayIso,
} from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiMoreLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { MiniKpiRow } from "../../components/common/MiniKpiRow";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
import { useAdoptBuilding } from "../../lib/activeBuilding";
import { buildingsQueryOptions } from "../../lib/buildings";
import { domainVisuals } from "../../lib/domainVisuals";
import { formatPeriod } from "../../lib/format";
import {
  heatingSettingsByIdQueryOptions,
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
 * Kennzahlen des Kopfbereichs
 */
const versionKpis = (version: HeatingSettings) => {
  const isInternal = version.mode === "internal";
  return [
    {
      label: t("ui.heating.kpi.split"),
      value: isInternal
        ? t("ui.heating.kpi.splitValue", {
            base: version.baseSharePercent,
            consumption: version.consumptionSharePercent,
          })
        : t("ui.heating.kpi.splitExternal"),
      hint: isInternal
        ? t("ui.heating.kpi.splitHint", {
            base: version.baseSharePercent,
            consumption: version.consumptionSharePercent,
          })
        : t("ui.heating.kpi.splitExternalHint"),
    },
    {
      label: t("ui.heating.kpi.proration"),
      value: t(`ui.heating.prorationShort.${version.prorationMethod}`),
      hint: t(`ui.heating.prorationHints.${version.prorationMethod}`),
    },
  ];
};

/**
 * Heizkosten-Ansicht: Kopf, Kennzahlen, Abrechnung und Heizungsanlage als
 * Werte-Cards, im externen Modus zusätzlich die Endbeträge je Wohnung
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

  if (!(version && buildings && metersResult)) {
    return (
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon icon={domainVisuals.heating.icon} />}
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
          tile={<PageHeaderIcon icon={domainVisuals.heating.icon} />}
          title={t("ui.heating.identityTitle", {
            validFrom: formatDate(version.validFrom),
          })}
          titleExtra={
            <Badge variant={active ? "ok" : "neutral"}>
              {active
                ? t("ui.heating.versions.statusActive")
                : t("ui.heating.versions.statusArchived")}
            </Badge>
          }
          sub={[
            building?.name,
            isInternal
              ? t(`ui.heating.heatingTypes.${version.heatingType}`)
              : t("ui.heating.modes.external"),
            isInternal
              ? t(`ui.heating.fuelTypes.${version.fuelType}`)
              : undefined,
          ]
            .filter(Boolean)
            .join(t("ui.common.separators.bullet"))}
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild={true}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("ui.common.a11y.more")}
                >
                  <RiMoreLine />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => deletion.request(version)}
                >
                  <RiDeleteBinLine />
                  {t("ui.heating.detail.deleteAction")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <div className="space-y-5">
          <MiniKpiRow columns={2} items={versionKpis(version)} />

          <div>
            <HeatingBillingCard
              version={version}
              onEdit={() => setSheet("billing")}
            />

            <HeatingProrationCard
              version={version}
              onEdit={() => setSheet("proration")}
            />

            {isInternal ? (
              <HeatingInstallationCard
                version={version}
                hotWaterMeter={metersResult.items.find(
                  (meter) => meter.id === version.hotWaterMeterId,
                )}
                onEdit={() => setSheet("installation")}
              />
            ) : (
              <ExternalHeatingEntriesCard buildingId={version.buildingId} />
            )}
          </div>
        </div>
      </div>

      {sheet === "billing" ? (
        <HeatingBillingSheet
          defaultValues={formValues}
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
