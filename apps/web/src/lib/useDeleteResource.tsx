import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { DestructiveConfirmDialog } from "@/components/DestructiveConfirmDialog";
import { api } from "./api";
import { t } from "./i18n";
import { toastApiError } from "./toastApiError";
import { AGGREGATE_QUERY_KEYS } from "./useCrudMutation";

type UseDeleteResourceOptions<T extends { id: string }> = {
  endpoint: (resource: T) => string;
  invalidateKeys: readonly (readonly unknown[])[];
  title: string;
  describe: (resource: T) => ReactNode;

  /**
   * Was außer dem Datensatz mit gelöscht wird (hervorgehoben)
   */
  consequence?: ReactNode | ((resource: T) => ReactNode);

  /**
   * Hinweis nach der Folge, z.B. eine Alternative zum Löschen
   */
  hint?: ReactNode;
  confirmLabel?: string;
  defaultErrorMessage?: string;
  onDeleted?: () => void;
};

export type DeleteResource<T extends { id: string }> = {
  deletingId: string | undefined;
  request: (resource: T) => void;
  rowClassName: (row: T) => string | undefined;
  dialog: ReactNode;
};

export const useDeleteResource = <T extends { id: string }>({
  endpoint,
  invalidateKeys,
  title,
  describe,
  consequence,
  hint,
  confirmLabel = t("ui.common.action.confirmDelete"),
  defaultErrorMessage = t("common.deleteFailed"),
  onDeleted,
}: UseDeleteResourceOptions<T>): DeleteResource<T> => {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<T | null>(null);

  const mutation = useMutation({
    mutationFn: (resource: T) => api.delete(endpoint(resource)),
    onSuccess: async () => {
      // Die eigene Domäne sofort neu laden,
      // die Sammel-Sichten nur als veraltet markieren.
      await Promise.all([
        ...invalidateKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey, refetchType: "all" }),
        ),
        ...AGGREGATE_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey, refetchType: "none" }),
        ),
      ]);
      setTarget(null);
      toast.success(t("common.deleted"));
      onDeleted?.();
    },
    // Der Bestätigungsdialog schließt beim Klick auf "Löschen" (Radix
    // AlertDialogAction), die Meldung braucht also ein eigenes Ziel,
    // dieselbe Stelle, an der auch der Erfolg quittiert wird.
    onError: toastApiError(defaultErrorMessage),
  });

  const deletingId = mutation.isPending ? mutation.variables?.id : undefined;

  const request = useCallback((resource: T) => {
    setTarget(resource);
  }, []);

  const rowClassName = useCallback(
    (row: T) =>
      row.id === deletingId
        ? "line-through text-muted-foreground opacity-60"
        : undefined,
    [deletingId],
  );

  const dialog = (
    <DestructiveConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          setTarget(null);
        }
      }}
      title={title}
      description={target ? describe(target) : undefined}
      consequence={
        target && typeof consequence === "function"
          ? consequence(target)
          : (consequence as ReactNode)
      }
      hint={hint}
      confirmLabel={confirmLabel}
      onConfirm={() => {
        if (target) {
          mutation.mutate(target);
        }
      }}
    />
  );

  return { deletingId, request, rowClassName, dialog };
};
