import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { RowActions } from "@/components/RowActions";
import type { DeleteResource } from "./useDeleteResource";

export const rowActionsColumn = <T,>({
  deletion,
  editLink,
  editLabel,
  extraActions,
}: {
  deletion?: DeleteResource<T & { id: string }>;
  editLink?: (row: T) => ReactNode;
  editLabel?: string;
  extraActions?: (row: T) => ReactNode;
}): ColumnDef<T> => ({
  id: "actions",
  enableSorting: false,
  header: () => null,
  cell: ({ row }) => (
    <RowActions
      isDeleting={
        deletion
          ? (row.original as T & { id: string }).id === deletion.deletingId
          : undefined
      }
      editLink={editLink?.(row.original)}
      editLabel={editLabel}
      extraActions={extraActions?.(row.original)}
      onDelete={
        deletion
          ? () => deletion.request(row.original as T & { id: string })
          : undefined
      }
    />
  ),
});
