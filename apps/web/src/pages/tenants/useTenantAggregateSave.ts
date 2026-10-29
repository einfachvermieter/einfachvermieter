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
 * Meldungen aller Regeln, die die Formularwerte verletzen
 */
const ruleProblems = (values: TenantFormValues): string[] => {
  const parsed = tenantFormSchemaRefined.safeParse(values);
  return parsed.success
    ? []
    : parsed.error.issues.map(
        (issue) => translateKey(issue.message) || t("common.saveFailed"),
      );
};

/**
 * Prüft eine Änderung am Aggregat vorab mit denselben Regeln wie beim
 * Speichern. Liefert die Meldung der ersten Regel, die erst durch die
 * Änderung verletzt wird, sonst null. Was schon vorher verletzt war, sperrt
 * die Änderung nicht
 */
export const tenantChangeProblem = (
  aggregate: TenantAggregate,
  mutate: (values: TenantFormValues) => TenantFormValues,
): string | null => {
  const current = tenantAggregateToFormValues(aggregate);
  const before = new Set(ruleProblems(current));
  return (
    ruleProblems(mutate(current)).find((problem) => !before.has(problem)) ??
    null
  );
};

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
    // "accounts" aktiv neu laden: die KPI-Tiles (Kaution, Saldo)
    // hängen daran und sind beim Speichern gerade eingeblendet.
    invalidateKeys: [["tenants"], ["accounts"]],
  });

  return async (mutate: (values: TenantFormValues) => TenantFormValues) => {
    const next = mutate(tenantAggregateToFormValues(aggregate));
    const [problem] = ruleProblems(next);
    if (problem) {
      throw new Error(problem);
    }

    await mutation.mutateAsync(tenantFormToDto(next));

    await router.invalidate();
  };
};
