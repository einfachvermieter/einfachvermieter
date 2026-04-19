import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "./i18n";

type SetQueryDataEntry<TData> = {
  queryKey: readonly unknown[];
  updater: (data: TData) => unknown;
};

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

      await Promise.all(
        invalidateKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );

      if (successMessage !== null) {
        toast.success(successMessage ?? t("common.saved"));
      }

      onSuccess?.();
    },
  });
};
