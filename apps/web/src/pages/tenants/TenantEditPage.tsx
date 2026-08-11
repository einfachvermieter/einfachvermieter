import {
  formatDate,
  type TenantSaveDto,
  tenantAggregateToFormValues,
  todayIso,
} from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiWallet3Line } from "@remixicon/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ActionLink } from "../../components/common/ActionLink";
import { InfoCard } from "../../components/common/InfoCard";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Badge } from "../../components/ui/Badge";
import { tenantBalanceQueryOptions } from "../../lib/accounts";
import { api } from "../../lib/api";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { type TenantAggregate, tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { TenantDetailHeader } from "./TenantDetailHeader";
import { TenantForm } from "./TenantForm";
import { TenantHero } from "./TenantHero";

const routeApi = getRouteApi("/mieter/$tenantId");

export const TenantEditPage = () => {
  const { tenantId } = routeApi.useParams();

  const { data: aggregate } = useSuspenseQuery(tenantQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);
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
    invalidateKeys: [["tenants"]],
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

  const today = todayIso();

  const currentOccupants = aggregate.residents.filter((resident) => {
    const moveIn = resident.moveInDate ?? tenant.startDate;
    const moveOut = resident.moveOutDate ?? tenant.endDate;
    return moveIn <= today && (moveOut === null || moveOut >= today);
  }).length;

  const balanced = balance ? balance.balanceCents >= 0 : undefined;

  return (
    <div className="pb-24">
      <TenantHero tenantId={tenantId} />

      <TenantDetailHeader tenantId={tenantId} active="stammdaten" />

      {units ? (
        <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] *:min-w-0">
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

          <div className="flex flex-col gap-4 xl:sticky xl:top-24">
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
                {t("ui.tenants.tabs.account")}
              </ActionLink>
            </InfoCard>

            <InfoCard
              title={t("ui.common.infoCards.details")}
              rows={[
                {
                  label: t("ui.tenant.fields.residents"),
                  value: currentOccupants,
                },
                {
                  label: t("ui.tenant.atAGlance.account"),
                  value:
                    balanced === undefined ? (
                      t("ui.common.emptyValue")
                    ) : (
                      <Badge variant={balanced ? "ok" : "warn"} dot={true}>
                        {balanced
                          ? t("ui.account.status.balanced")
                          : t("ui.account.status.open")}
                      </Badge>
                    ),
                },
              ]}
            />

            <InfoCard title={t("ui.common.infoCards.actions")}>
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
      ) : (
        <div className="mt-6">
          <FormSkeleton rows={6} aside={true} />
        </div>
      )}

      {deletion.dialog}
    </div>
  );
};
