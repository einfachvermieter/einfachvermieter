import type { RemixiconComponentType } from "@remixicon/react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { RowActions } from "@/components/RowActions";
import type { DeleteResource } from "./useDeleteResource";

/**
 * Schmale erste Spalte mit einer freistehenden Kachel je Zeile
 */
export const rowTileColumn = <T,>(
  tile: (row: T) => ReactNode,
): ColumnDef<T> => ({
  id: "tile",
  enableSorting: false,
  header: () => null,
  cell: ({ row }) => tile(row.original),
  meta: {
    cellClassName: "w-0 pr-0",
    headerClassName: "w-0 pr-0",
  },
});

/**
 * Kachel-Spalte mit einem Icon je Zeile
 */
export const rowIconColumn = <T,>(
  icon: (row: T) => RemixiconComponentType,
): ColumnDef<T> =>
  rowTileColumn<T>((row) => {
    const Icon = icon(row);
    return <Icon aria-hidden={true} className="size-5 text-muted-foreground" />;
  });

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
