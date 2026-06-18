import {
  formatDate,
  formatNumber,
  type MeterCreateDto,
} from "@einfachvermieter/shared";
import { RiDeleteBinLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ActionLink } from "../../components/common/ActionLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { HeroBand } from "../../components/common/HeroBand";
import { IconTile } from "../../components/common/IconTile";
import { InfoCard } from "../../components/common/InfoCard";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { costTypesQueryOptions } from "../../lib/costs";
import { domainVisuals, meterTypeVisual } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import type { Meter } from "../../lib/meters";
import {
  measurementUnitLabel,
  meterQueryOptions,
  meterRoleLabel,
  meterTypeLabel,
  readingsQueryOptions,
} from "../../lib/meters";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { meterToFormValues } from "./components/meterFormHelpers";
import { MeterReadingsTab } from "./components/readings/MeterReadingsTab";
import { MeterForm } from "./MeterForm";

export const MeterDetailPage = () => {
  const { meterId } = useParams({ strict: false }) as { meterId: string };
  const navigate = useNavigate();

  const meterQuery = useQuery(meterQueryOptions(meterId));
  const meter = meterQuery.data;
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: costTypes } = useQuery(costTypesQueryOptions);
  const { data: readings } = useQuery(readingsQueryOptions(meterId));

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

  const unitLabel = measurementUnitLabel(meter.measurementUnit);
  const dash = t("ui.common.emptyValue");
  const sorted = [...(readings ?? [])].sort((a, b) =>
    b.readingDate.localeCompare(a.readingDate),
  );
  const latest = sorted[0] ?? null;
  const year = new Date().getFullYear();
  const baseline = sorted.find((r) => r.readingDate < `${year}-01-01`) ?? null;
  const consumption = latest && baseline ? latest.value - baseline.value : null;

  const lastReadingText = latest
    ? `${formatNumber(latest.value)} ${unitLabel}`
    : dash;
  const consumptionText =
    consumption !== null ? `${formatNumber(consumption)} ${unitLabel}` : dash;
  const unit = meter.unitId
    ? units.find((entry) => entry.id === meter.unitId)
    : undefined;

  return (
    <div className="pb-24">
      <HeroBand
        tile={
          <IconTile
            icon={meterTypeVisual(meter.type).icon}
            size={64}
            background={meterTypeVisual(meter.type).gradient}
          />
        }
        eyebrow={t("ui.meters.editTitle")}
        title={meter.label}
        meta={[meterTypeLabel(meter.type), meterRoleLabel(meter.role)].join(
          t("ui.common.separators.bullet"),
        )}
        stats={[
          {
            label: t("ui.meters.detail.statLastReading"),
            value: lastReadingText,
          },
          {
            label: t("ui.meters.detail.statConsumption", { year }),
            value: consumptionText,
          },
          {
            label: t("ui.meters.detail.statStatus"),
            value: meter.isActive
              ? t("ui.meters.detail.statusActive")
              : t("ui.meters.detail.statusInactive"),
          },
        ]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
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
          <MeterReadingsTab
            meterId={meterId}
            measurementUnit={meter.measurementUnit}
            role={meter.role}
          />
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <InfoCard
            title={t("ui.common.infoCards.atAGlance")}
            rows={[
              {
                label: t("ui.meters.fields.type"),
                value: meterTypeLabel(meter.type),
              },
              {
                label: t("ui.meters.detail.usageLabel"),
                value: (
                  <Badge variant="blue">{meterRoleLabel(meter.role)}</Badge>
                ),
              },
              {
                label: t("ui.meters.fields.unit"),
                value: unit ? (
                  <Link
                    to="/wohnungen/$unitId"
                    params={{ unitId: unit.id }}
                    className="font-semibold text-sky-700 dark:text-sky-400"
                  >
                    {unit.name}
                  </Link>
                ) : (
                  dash
                ),
              },
              {
                label: t("ui.meters.detail.lastReadingLabel"),
                value: latest ? formatDate(latest.readingDate) : dash,
              },
            ]}
          />

          <InfoCard title={t("ui.common.infoCards.actions")}>
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
                {t("ui.meters.detail.openUnit")}
              </ActionLink>
            ) : null}
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
