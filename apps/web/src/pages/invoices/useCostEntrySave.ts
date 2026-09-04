import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { api } from "../../lib/api";
import type { CostEntryDetail, CostType } from "../../lib/costs";
import { t, translateKey } from "../../lib/i18n";
import { useCrudMutation } from "../../lib/useCrudMutation";
import {
  type CostEntryFormValues,
  type CostEntrySubmitValues,
  costEntryFormSchema,
  costEntryFormToDto,
  costEntryToFormValues,
} from "./components/baseData/costEntryForm.schema";

/**
 * Sofort-Speichern eines Teilschritts der Rechnung: nimmt den aktuellen
 * Serverstand, wendet die Änderung an, prüft das Formular-Schema und PATCHt
 * die komplette Rechnung samt Positionen.
 */
export const useCostEntrySave = (
  entry: CostEntryDetail | undefined,
  costTypes: CostType[],
) => {
  const router = useRouter();
  const mutation = useCrudMutation({
    // Das Gebäude der Rechnung steht mit dem Anlegen fest
    mutationFn: ({ buildingId: _ignored, ...dto }: CostEntrySubmitValues) =>
      api.patch<CostEntryDetail>(`/costs/${entry?.id}`, dto),
    invalidateKeys: [
      ["costs"],
      ["costEntry", entry?.id ?? ""],

      // Entwürfe rechnen live aus den Stammdaten, der Vorschau-Cache muss
      // nach jeder Rechnungsänderung neu geladen werden.
      ["statement-preview"],
    ],

    // Die Meldung gibt die Aufrufstelle: nach einer KI-Auswertung ist
    // "Gespeichert" die falsche Nachricht.
    successMessage: null,
  });

  return async (
    mutate: (values: CostEntryFormValues) => CostEntryFormValues,
    /**
     * Abweichende Erfolgsmeldung
     */
    successMessage?: string,
  ) => {
    if (!entry) {
      return;
    }

    const next = mutate(costEntryToFormValues(entry, costTypes));

    const parsed = costEntryFormSchema.safeParse(next);
    if (!parsed.success) {
      const message = translateKey(parsed.error.issues[0]?.message);
      throw new Error(message || t("common.saveFailed"));
    }

    await mutation.mutateAsync(costEntryFormToDto(next, costTypes));

    await router.invalidate();
    toast.success(successMessage ?? t("common.saved"));
  };
};
