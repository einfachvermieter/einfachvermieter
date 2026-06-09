import {
  formatDate,
  formatEur,
  formatName,
  pickRentForDate,
  type TenantSaveDto,
  tenantAggregateToFormValues,
  todayIso,
} from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiWallet3Line } from "@remixicon/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ActionLink } from "../../components/common/ActionLink";
import { HeroBand } from "../../components/common/HeroBand";
import { InfoCard } from "../../components/common/InfoCard";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Badge } from "../../components/ui/Badge";
import { tenantBalanceQueryOptions } from "../../lib/accounts";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { t } from "../../lib/i18n";
import { type TenantAggregate, tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { TenantDetailHeader } from "./TenantDetailHeader";
import { TenantForm } from "./TenantForm";

const routeApi = getRouteApi("/mieter/$tenantId");

export const TenantEditPage = () => {
  const { tenantId } = routeApi.useParams();

  const { data: aggregate } = useSuspenseQuery(tenantQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { data: balance } = useQuery(tenantBalanceQueryOptions(tenantId));
  const navigate = useNavigate();

  const goToList = useGoBack("/mieter", { search: { buildingId: undefined } });

  const updateTenant = useCrudMutation({
    mutationFn: (dto: TenantSaveDto) =>
      api.patch<TenantAggregate>(`/tenants/${tenantId}`, dto),
    setQueryData: [{ queryKey: ["tenant", tenantId], updater: (data) => data }],
    invalidateKeys: [["tenants"]],
    onSuccess: goToList,
  });

  const deletion = useDeleteResource<{ id: string }>({
    endpoint: (target) => `/tenants/${target.id}`,
    invalidateKey: ["tenants"],
    title: t("ui.tenants.confirmDeleteTenant"),
    describe: () =>
      t("ui.tenants.confirmDeleteTenantMessage", {
        unit: unit?.name ?? "",
        start: formatDate(tenant.startDate),
        end: tenant.endDate
          ? formatDate(tenant.endDate)
          : t("errors.tenantOpenEnd"),
      }),
    onDeleted: () =>
      navigate({ to: "/mieter", search: { buildingId: undefined } }),
  });

  const { tenant } = aggregate;
  const unit = units?.find((entry) => entry.id === tenant.unitId);
  const building = buildings?.find((entry) => entry.id === unit?.buildingId);

  if (!units) {
    return <FormSkeleton rows={6} />;
  }

  const today = todayIso();
  const active =
    tenant.startDate <= today &&
    (tenant.endDate === null || tenant.endDate >= today);

  const contractParties = aggregate.residents.filter(
    (resident) => resident.isContractParty,
  );
  const names = contractParties
    .map((resident) => formatName(resident.firstName, resident.lastName))
    .join(t("ui.common.separators.comma"));
  const heroName = names || (unit?.name ?? "");

  const currentRent = pickRentForDate(aggregate.rents, today);
  const warmRentCents = currentRent
    ? currentRent.monthlyBaseRentCents + currentRent.monthlyAdvanceCents
    : null;

  const currentOccupants = aggregate.residents.filter((resident) => {
    const moveIn = resident.moveInDate ?? tenant.startDate;
    const moveOut = resident.moveOutDate ?? tenant.endDate;
    return moveIn <= today && (moveOut === null || moveOut >= today);
  }).length;

  const balanced = balance ? balance.balanceCents >= 0 : undefined;

  return (
    <div className="pb-24">
      <HeroBand
        tile={<InitialsAvatar name={heroName} size={64} />}
        eyebrow={t("ui.tenant.editEyebrow")}
        title={heroName}
        meta={[
          building?.name,
          unit?.name,
          t("ui.tenants.termSince", { date: formatDate(tenant.startDate) }),
        ]
          .filter(Boolean)
          .join(t("ui.common.separators.bullet"))}
        stats={[
          {
            label: t("ui.tenant.hero.warmRent"),
            value:
              warmRentCents !== null
                ? formatEur(warmRentCents)
                : t("ui.common.emptyValue"),
          },
          {
            label: t("ui.tenant.fields.deposit"),
            value:
              tenant.depositCents > 0
                ? formatEur(tenant.depositCents)
                : t("ui.common.emptyValue"),
          },
          {
            label: t("ui.tenant.hero.livesSince"),
            value: formatDate(tenant.startDate),
          },
          {
            label: t("ui.common.columns.status"),
            value: active ? t("ui.tenants.active") : t("ui.tenants.inactive"),
          },
        ]}
      />

      <TenantDetailHeader
        tenantId={tenantId}
        active="stammdaten"
        hideTitle={true}
      />

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <TenantForm
          mode="edit"
          units={units}
          defaultValues={tenantAggregateToFormValues(aggregate)}
          serverVersion={aggregate.tenant.updatedAt}
          savedAt={
            tenant.updatedAt
              ? formatDate(tenant.updatedAt.slice(0, 10))
              : undefined
          }
          onSubmit={async (values) => {
            await updateTenant.mutateAsync(values);
          }}
          onCancel={goToList}
        />

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <InfoCard
            title={t("ui.tenant.atAGlance.title")}
            rows={[
              {
                label: t("ui.tenant.hero.livesSince"),
                value: formatDate(tenant.startDate),
              },
              {
                label: t("ui.tenant.fields.residents"),
                value: currentOccupants,
              },
              {
                label: t("ui.tenant.fields.deposit"),
                value:
                  tenant.depositCents > 0
                    ? formatEur(tenant.depositCents)
                    : t("ui.common.emptyValue"),
              },
              {
                label: t("ui.tenant.atAGlance.account"),
                value:
                  balanced === undefined ? (
                    t("ui.common.emptyValue")
                  ) : (
                    <Link to="/mieter/$tenantId/konto" params={{ tenantId }}>
                      <Badge variant={balanced ? "ok" : "warn"} dot={true}>
                        {balanced
                          ? t("ui.account.status.balanced")
                          : t("ui.account.status.open")}
                      </Badge>
                    </Link>
                  ),
              },
            ]}
          />

          <InfoCard title={t("ui.common.infoCards.actions")}>
            <ActionLink
              icon={RiWallet3Line}
              iconBackground="var(--i-cyan)"
              onClick={() =>
                navigate({
                  to: "/mieter/$tenantId/konto",
                  params: { tenantId },
                })
              }
            >
              {t("ui.tenants.openAccount")}
            </ActionLink>
            <ActionLink
              icon={RiDeleteBinLine}
              iconBackground="var(--color-rose-400)"
              danger={true}
              onClick={() => deletion.request({ id: tenantId })}
            >
              {t("ui.tenant.actions.delete")}
            </ActionLink>
          </InfoCard>
        </div>
      </div>

      {deletion.dialog}
    </div>
  );
};
