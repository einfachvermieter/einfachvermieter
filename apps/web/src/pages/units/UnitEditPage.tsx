import {
  formatDate,
  formatName,
  formatNumber,
  type UnitCreateDto,
} from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiStore2Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ActionLink } from "../../components/common/ActionLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { IconTile } from "../../components/common/IconTile";
import { InfoCard } from "../../components/common/InfoCard";
import { PageHeader } from "../../components/common/PageHeader";
import { FormSkeleton } from "../../components/FormSkeleton";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import {
  type TenantOverviewRow,
  tenantsOverviewQueryOptions,
} from "../../lib/tenants";
import type { Unit } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { UnitForm } from "./UnitForm";

const routeApi = getRouteApi("/wohnungen/$unitId");

/**
 * Aktueller Mietvertrag der Wohnung (aktiv zum Stichtag heute)
 */
const currentTenantOf = (
  rows: TenantOverviewRow[] | undefined,
  unitId: string,
): TenantOverviewRow | undefined =>
  rows?.find((row) => row.unitId === unitId && row.active);

export const UnitEditPage = () => {
  const { unitId } = routeApi.useParams();

  const unit = routeApi.useLoaderData();
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const navigate = useNavigate();

  const goBack = useGoBack("/wohnungen");

  const { data: tenants } = useQuery({
    ...tenantsOverviewQueryOptions({
      page: 0,
      pageSize: 1000,
      buildingId: unit?.buildingId,
    }),
    enabled: unit !== undefined,
  });

  const updateUnit = useCrudMutation({
    mutationFn: ({ buildingId: _ignored, ...dto }: UnitCreateDto) =>
      api.patch<Unit>(`/units/${unitId}`, dto),
    invalidateKeys: [["units"], ["unit", unitId]],
    onSuccess: goBack,
  });

  const deletion = useDeleteResource<Unit>({
    endpoint: (target) => `/units/${target.id}`,
    invalidateKey: ["units"],
    title: t("ui.units.confirmDelete"),
    describe: (target) =>
      t("ui.units.confirmDeleteMessage", { name: target.name }),
    onDeleted: () =>
      navigate({ to: "/wohnungen", search: { buildingId: unit?.buildingId } }),
  });

  if (!unit) {
    return (
      <EntityNotFound
        title={t("ui.units.notFound.title")}
        description={t("ui.units.notFound.description")}
        to="/wohnungen"
      />
    );
  }

  const building = buildings?.find((entry) => entry.id === unit.buildingId);
  const current = currentTenantOf(tenants?.items, unit.id);

  let statusLabel = t("ui.units.status.vacant");
  if (current) {
    statusLabel =
      current.kind === "owner"
        ? t("ui.units.status.owner")
        : t("ui.units.status.rented");
  }
  const tenantNames = current
    ? current.contractResidents
        .map((resident) => formatName(resident.firstName, resident.lastName))
        .join(t("ui.common.separators.comma"))
    : undefined;

  // Hero-Stat: Vornamen auf Initial kürzen ("M. Schmidt"), damit die
  // Kennzahl bei schmalen Fenstern nicht umbricht
  const tenantNamesShort = current
    ? current.contractResidents
        .map((resident) => {
          const first = resident.firstName?.trim() ?? "";
          const last = resident.lastName?.trim() ?? "";
          return first && last ? `${first.charAt(0)}. ${last}` : last || first;
        })
        .join(t("ui.common.separators.comma"))
    : undefined;

  const isCommercial = current?.kind === "commercial";

  return (
    <div className="pb-24">
      <PageHeader
        tile={
          <IconTile
            icon={isCommercial ? RiStore2Line : domainVisuals.units.icon}
            size={44}
            background={isCommercial ? gradients.commercial : gradients.units}
          />
        }
        title={unit.name}
        sub={[
          building?.name,
          unit.unitNumber
            ? t("ui.units.unitNumberMeta", { number: unit.unitNumber })
            : undefined,
        ]
          .filter(Boolean)
          .join(t("ui.common.separators.bullet"))}
        stats={[
          {
            label: t("ui.units.fields.area"),
            value: `${formatNumber(unit.areaSqm, 2)} m²`,
          },
          { label: t("ui.units.status.label"), value: statusLabel },
          {
            label: t("ui.units.fields.tenant"),
            value: tenantNamesShort ?? t("ui.common.emptyValue"),
          },
        ]}
      />

      {buildings ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] *:min-w-0">
          <UnitForm
            mode="edit"
            buildings={buildings}
            savedAt={
              unit.updatedAt
                ? formatDate(unit.updatedAt.slice(0, 10))
                : undefined
            }
            defaultValues={{
              buildingId: unit.buildingId,
              name: unit.name,
              unitNumber: unit.unitNumber ?? "",
              areaSqm: String(unit.areaSqm),
              heatingAreaSqm:
                unit.heatingAreaSqm === null ? "" : String(unit.heatingAreaSqm),
            }}
            onSubmit={async (values) => {
              await updateUnit.mutateAsync(values);
            }}
            onCancel={goBack}
          />

          <div className="flex flex-col gap-4 xl:sticky xl:top-24">
            <InfoCard title={t("ui.common.infoCards.links")}>
              {current ? (
                <ActionLink
                  icon={domainVisuals.tenants.icon}
                  iconBackground={domainVisuals.tenants.accent}
                  subtitle={t("ui.units.links.tenantSince", {
                    date: formatDate(current.startDate),
                  })}
                  onClick={() =>
                    navigate({
                      to: "/mieter/$tenantId",
                      params: { tenantId: current.id },
                    })
                  }
                >
                  {tenantNames}
                </ActionLink>
              ) : null}
              <ActionLink
                icon={domainVisuals.meters.icon}
                iconBackground={domainVisuals.meters.accent}
                onClick={() =>
                  navigate({
                    to: "/zaehler",
                    search: {
                      buildingId: unit.buildingId,
                      unitId: unit.id,
                      type: undefined,
                    },
                  })
                }
              >
                {t("ui.units.actions.unitMeters")}
              </ActionLink>
            </InfoCard>

            <InfoCard title={t("ui.common.infoCards.actions")}>
              <ActionLink
                icon={RiDeleteBinLine}
                iconBackground="var(--color-rose-400)"
                danger={true}
                onClick={() => deletion.request(unit)}
              >
                {t("ui.units.actions.delete")}
              </ActionLink>
            </InfoCard>
          </div>
        </div>
      ) : (
        <FormSkeleton rows={3} />
      )}

      {deletion.dialog}
    </div>
  );
};
