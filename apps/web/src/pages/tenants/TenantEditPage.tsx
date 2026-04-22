import {
  type TenantSaveDto,
  tenantAggregateToFormValues,
} from "@einfachvermieter/shared";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { FormSkeleton } from "../../components/FormSkeleton";
import { api } from "../../lib/api";
import { type TenantAggregate, tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { TenantDetailHeader } from "./TenantDetailHeader";
import { TenantForm } from "./TenantForm";

const routeApi = getRouteApi("/mieter/$tenantId");

export const TenantEditPage = () => {
  const { tenantId } = routeApi.useParams();

  const { data: aggregate } = useSuspenseQuery(tenantQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);

  const goToList = useGoBack("/mieter", { search: { buildingId: undefined } });

  const updateTenant = useCrudMutation({
    mutationFn: (dto: TenantSaveDto) =>
      api.patch<TenantAggregate>(`/tenants/${tenantId}`, dto),
    setQueryData: [{ queryKey: ["tenant", tenantId], updater: (data) => data }],
    invalidateKeys: [["tenants"]],
    onSuccess: goToList,
  });

  if (!units) {
    return <FormSkeleton rows={6} />;
  }

  return (
    <div className="space-y-6">
      <TenantDetailHeader tenantId={tenantId} active="stammdaten" />
      <TenantForm
        mode="edit"
        units={units}
        defaultValues={tenantAggregateToFormValues(aggregate)}
        serverVersion={aggregate.tenant.updatedAt}
        onSubmit={async (values) => {
          await updateTenant.mutateAsync(values);
        }}
        onCancel={goToList}
      />
    </div>
  );
};
