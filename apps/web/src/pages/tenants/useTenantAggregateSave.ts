import {
  type TenantFormValues,
  type TenantSaveDto,
  tenantAggregateToFormValues,
  tenantFormSchemaRefined,
  tenantFormToDto,
} from "@einfachvermieter/shared";
import { useRouter } from "@tanstack/react-router";
import { api } from "../../lib/api";
import { t, translateKey } from "../../lib/i18n";
import type { TenantAggregate } from "../../lib/tenants";
import { useCrudMutation } from "../../lib/useCrudMutation";

/**
 * Sofort-Speichern eines Teilschritts der Mieter-Stammdaten: nimmt den
 * aktuellen Serverstand, wendet die Änderung an, prüft die Regeln
 * (Kreuzvalidierung, z.B. Vertragspartner-Abdeckung und
 * Mietsatz-Überlappungen) und PATCHt das komplette Aggregat.
 */
export const useTenantAggregateSave = (
  tenantId: string,
  aggregate: TenantAggregate,
) => {
  const router = useRouter();
  const mutation = useCrudMutation({
    mutationFn: (dto: TenantSaveDto) =>
      api.patch<TenantAggregate>(`/tenants/${tenantId}`, dto),
    setQueryData: [{ queryKey: ["tenant", tenantId], updater: (data) => data }],
    // "accounts" aktiv neu laden: die Kennzahl-Kacheln (Kaution, Saldo)
    // haengen daran und sind beim Speichern gerade eingeblendet.
    invalidateKeys: [["tenants"], ["accounts"]],
  });

  return async (mutate: (values: TenantFormValues) => TenantFormValues) => {
    const next = mutate(tenantAggregateToFormValues(aggregate));

    const parsed = tenantFormSchemaRefined.safeParse(next);
    if (!parsed.success) {
      const message = translateKey(parsed.error.issues[0]?.message);
      throw new Error(message || t("common.saveFailed"));
    }

    await mutation.mutateAsync(tenantFormToDto(next));

    await router.invalidate();
  };
};
