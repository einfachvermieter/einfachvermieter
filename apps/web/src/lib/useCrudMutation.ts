import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "./i18n";

type SetQueryDataEntry<TData> = {
  queryKey: readonly unknown[];
  updater: (data: TData) => unknown;
};

/**
 * Sammel-Sichten, die von fast jeder Änderung abhängen: Abrechnungsvorschau,
 * Mieterkonto, Abrechnungsliste und Kennzahlen. Eine geänderte Miete, ein
 * neuer Zählerstand oder eine andere Wohnfläche wirken dort hinein, ohne dass
 * die Aufrufstelle das jedes Mal aufzählen müsste.
 */
export const AGGREGATE_QUERY_KEYS = [
  ["statement-preview"],
  ["statements"],
  ["accounts"],
  ["stats"],
] as const;

export const useCrudMutation = <TData, TVariables>({
  mutationFn,
  invalidateKeys,
  setQueryData,
  onSuccess,
  successMessage,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys: readonly (readonly unknown[])[];
  setQueryData?: readonly SetQueryDataEntry<TData>[];
  onSuccess?: () => void;
  /**
   * Erfolgs-Toast. Default `common.saved` ("Gespeichert"). `null` unterdrückt
   * ihn (z. B. wenn der Aufrufer eigenes Feedback gibt). Fehler werden hier
   * bewusst NICHT gezeigt. Forms zeigen sie inline (siehe `Form.tsx`).
   */
  successMessage?: string | null;
}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (data) => {
      if (setQueryData) {
        for (const entry of setQueryData) {
          queryClient.setQueryData(entry.queryKey, entry.updater(data));
        }
      }

      await Promise.all([
        // `refetchType: "all"` da Detail-Queries an Router-Loader hängt.
        // Würden sonst nicht neu geladen und veraltete Daten im Formular anzeigen.
        ...invalidateKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey, refetchType: "all" }),
        ),
        // Sammelansichten nur als veraltet markieren.
        ...AGGREGATE_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey, refetchType: "none" }),
        ),
      ]);

      if (successMessage !== null) {
        toast.success(successMessage ?? t("common.saved"));
      }

      onSuccess?.();
    },
  });
};
