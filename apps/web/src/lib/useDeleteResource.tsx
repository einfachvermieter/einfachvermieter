import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { DestructiveConfirmDialog } from "@/components/DestructiveConfirmDialog";
import { ApiError, api } from "./api";
import { t } from "./i18n";

type UseDeleteResourceOptions<T extends { id: string }> = {
  endpoint: (resource: T) => string;
  invalidateKey: readonly unknown[];
  title: string;
  describe: (resource: T) => ReactNode;
  confirmLabel?: string;
  defaultErrorMessage?: string;
};

export type DeleteResource<T extends { id: string }> = {
  deletingId: string | undefined;
  request: (resource: T) => void;
  rowClassName: (row: T) => string | undefined;
  dialog: ReactNode;
};

export const useDeleteResource = <T extends { id: string }>({
  endpoint,
  invalidateKey,
  title,
  describe,
  confirmLabel = t("ui.common.action.delete"),
  defaultErrorMessage = t("common.deleteFailed"),
}: UseDeleteResourceOptions<T>): DeleteResource<T> => {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (resource: T) => api.delete(endpoint(resource)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invalidateKey }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
      ]);
      setTarget(null);
      toast.success(t("common.deleted"));
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : defaultErrorMessage);
    },
  });

  const deletingId = mutation.isPending ? mutation.variables?.id : undefined;

  const request = useCallback((resource: T) => {
    setError(null);
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
          setError(null);
        }
      }}
      title={title}
      description={
        target ? (
          <>
            {describe(target)}
            {error ? (
              <>
                {" "}
                <span className="text-destructive">{error}</span>
              </>
            ) : null}
          </>
        ) : undefined
      }
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
