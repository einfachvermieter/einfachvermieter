import {
  RiArrowDownLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowUpDownLine,
  RiArrowUpLine,
  RiCloseLine,
  RiContractLeftLine,
  RiContractRightLine,
  RiSearchLine,
} from "@remixicon/react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Header,
  type OnChangeFn,
  type PaginationState,
  type RowData,
  type SortingState,
  type Table as TableInstance,
  useReactTable,
} from "@tanstack/react-table";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/InputGroup";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Module-Augmentation
  interface ColumnMeta<TData extends RowData, TValue> {
    cellClassName?: string;
    headerClassName?: string;
  }
}

const PAGE_SIZES = [25, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Suchfeld erst ab dieser Zeilenzahl zeigen (progressive disclosure)
 */
const SEARCH_MIN_ROWS = 10;

const ServerSearchInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) {
      return;
    }
    const timer = setTimeout(() => onChange(draft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <InputGroup className="flex-1 bg-card sm:max-w-xs">
      <InputGroupInput
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
      />

      <InputGroupAddon>
        <RiSearchLine />
      </InputGroupAddon>

      {draft ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setDraft("")}
            aria-label={t("ui.common.table.searchReset")}
          >
            <RiCloseLine />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
};

const SortIndicator = ({ sorted }: { sorted: false | "asc" | "desc" }) => {
  if (sorted === "asc") {
    return <RiArrowUpLine className="size-3.5 text-muted-foreground" />;
  }

  if (sorted === "desc") {
    return <RiArrowDownLine className="size-3.5 text-muted-foreground" />;
  }

  // Icon erst beim Hover einblenden (dezent)
  return (
    <RiArrowUpDownLine className="size-3.5 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
  );
};

const renderHeaderContent = <TData,>(header: Header<TData, unknown>) => {
  if (header.isPlaceholder) {
    return null;
  }

  const content = flexRender(
    header.column.columnDef.header,
    header.getContext(),
  );

  if (!header.column.getCanSort()) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className="group -mx-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 uppercase transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
    >
      {content}
      <SortIndicator sorted={header.column.getIsSorted()} />
    </button>
  );
};

export type DataTableServer = {
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  search: string;
  onSearchChange: (value: string) => void;
  pageCount: number;
  searchPlaceholder?: string;
};

type DataTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  emptyMessage?: ReactNode;
  toolbar?: ReactNode;
  filter?: { columnId: string; placeholder?: string };
  pageSize?: number;
  server?: DataTableServer;
  loading?: boolean;
  rowClassName?: (row: TData) => string | undefined;
  totalRows?: number;

  /**
   * Macht die ganze Zeile klickbar (Chevron-Spalte rechts, Hover-Cursor)
   */
  onRowClick?: (row: TData) => void;
};

/**
 * Tabellenkörper: Skeleton, Datenzeilen oder Leer-Hinweis. Die
 * Skeleton-Zeilenzahl orientiert sich an der Seitengröße bzw. an totalRows.
 */
const DataTableBody = <TData,>({
  table,
  columns,
  loading,
  emptyMessage,
  rowClassName,
  totalRows,
  onRowClick,
}: {
  table: TableInstance<TData>;
  columns: ColumnDef<TData, unknown>[];
  loading: boolean;
  emptyMessage: ReactNode;
  rowClassName?: (row: TData) => string | undefined;
  totalRows?: number;
  onRowClick?: (row: TData) => void;
}) => {
  const currentPageSize = table.getState().pagination.pageSize;

  const columnKeys = useMemo(
    () => Array.from({ length: columns.length }, (_, i) => `col-${i}`),
    [columns],
  );

  const skeletonRowCount =
    totalRows === undefined
      ? currentPageSize
      : Math.max(Math.min(currentPageSize, totalRows), 1);
  const skeletonRowKeys = useMemo(
    () => Array.from({ length: skeletonRowCount }, (_, i) => `skeleton-${i}`),
    [skeletonRowCount],
  );

  if (loading && skeletonRowKeys.length > 0) {
    return skeletonRowKeys.map((rowKey) => (
      <TableRow key={rowKey}>
        {columnKeys.map((colKey) => (
          <TableCell key={colKey} className="h-15.5">
            <Skeleton className="h-4 w-[70%]" />
          </TableCell>
        ))}
      </TableRow>
    ));
  }

  if (table.getRowModel().rows.length > 0) {
    return table.getRowModel().rows.map((row) => (
      <TableRow
        key={row.id}
        data-state={row.getIsSelected() ? "selected" : undefined}
        className={cn(
          onRowClick && "cursor-pointer",
          rowClassName?.(row.original),
        )}
        onClick={
          onRowClick
            ? (event) => {
                // Klicks auf Buttons/Links in der Zeile nicht abfangen
                const interactive = (event.target as HTMLElement).closest(
                  "a, button, input, select, label, [role=menuitem], [role=dialog]",
                );
                if (!interactive) {
                  onRowClick(row.original);
                }
              }
            : undefined
        }
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell
            key={cell.id}
            className={cell.column.columnDef.meta?.cellClassName}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ));
  }

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={columns.length}
        className="h-24 text-center text-muted-foreground"
      >
        {emptyMessage}
      </TableCell>
    </TableRow>
  );
};

/**
 * Pagination-Fußleiste: Seitengröße, Seitenanzeige und Blätter-Buttons.
 * Leitet die Werte aus der Table-Instanz ab.
 */
const DataTablePagination = <TData,>({
  table,
}: {
  table: TableInstance<TData>;
}) => {
  const pageSizeId = useId();
  const currentPageSize = table.getState().pagination.pageSize;
  const currentPageIndex = table.getState().pagination.pageIndex;
  const totalPages = Math.max(1, table.getPageCount());

  return (
    <div className="flex w-full justify-between items-center gap-2 sm:gap-8">
      <div className="flex items-center gap-2">
        <Label
          htmlFor={pageSizeId}
          className="sr-only text-[13px] font-medium lg:not-sr-only"
        >
          {t("ui.common.pagination.entriesPerPage")}
        </Label>
        <Select
          value={String(currentPageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger size="sm" className="w-18 bg-card" id={pageSizeId}>
            <SelectValue placeholder={currentPageSize} />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex w-fit items-center justify-center text-[13px] font-medium text-muted-foreground">
        {t("ui.common.pagination.pageOf", {
          page: currentPageIndex + 1,
          total: totalPages,
        })}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          className="hidden bg-card lg:flex"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <RiContractLeftLine />
          <span className="sr-only">{t("ui.common.pagination.firstPage")}</span>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="bg-card"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <RiArrowLeftSLine />
          <span className="sr-only">
            {t("ui.common.pagination.previousPage")}
          </span>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="bg-card"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <RiArrowRightSLine />
          <span className="sr-only">{t("ui.common.pagination.nextPage")}</span>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="hidden bg-card lg:flex"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <RiContractRightLine />
          <span className="sr-only">{t("ui.common.pagination.lastPage")}</span>
        </Button>
      </div>
    </div>
  );
};

export const DataTable = <TData,>({
  data,
  columns,
  emptyMessage = t("ui.common.table.empty"),
  toolbar,
  filter,
  pageSize = 25,
  server,
  loading = false,
  rowClassName,
  totalRows,
  onRowClick,
}: DataTableProps<TData>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [clientPagination, setClientPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  // Chevron-Spalte signalisiert die klickbare Zeile
  const effectiveColumns = useMemo<ColumnDef<TData, unknown>[]>(
    () =>
      onRowClick
        ? [
            ...columns,
            {
              id: "chevron",
              enableSorting: false,
              header: () => null,
              cell: () => (
                <RiArrowRightSLine
                  aria-hidden={true}
                  className="size-4.5 text-slate-400"
                />
              ),
              meta: {
                cellClassName: "w-10 text-right",
                headerClassName: "w-10",
              },
            },
          ]
        : columns,
    [columns, onRowClick],
  );

  const table = useReactTable({
    data,
    columns: effectiveColumns,
    state: server
      ? { sorting: server.sorting, pagination: server.pagination }
      : { sorting, columnFilters, pagination: clientPagination },
    onSortingChange: server ? server.onSortingChange : setSorting,
    onColumnFiltersChange: server ? undefined : setColumnFilters,
    onPaginationChange: server
      ? server.onPaginationChange
      : setClientPagination,
    manualPagination: Boolean(server),
    manualSorting: Boolean(server),
    manualFiltering: Boolean(server),
    pageCount: server ? server.pageCount : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: server ? undefined : getSortedRowModel(),
    getFilteredRowModel: server ? undefined : getFilteredRowModel(),
    getPaginationRowModel: server ? undefined : getPaginationRowModel(),
  });

  const clientFilterColumn =
    !server && filter ? table.getColumn(filter.columnId) : null;

  let searchInput: ReactNode = null;
  if (server) {
    const showSearch =
      (totalRows ?? 0) >= SEARCH_MIN_ROWS || server.search.trim().length > 0;
    searchInput = showSearch ? (
      <ServerSearchInput
        value={server.search}
        onChange={server.onSearchChange}
        placeholder={
          server.searchPlaceholder ?? t("ui.common.table.searchPlaceholder")
        }
      />
    ) : null;
  } else if (clientFilterColumn) {
    searchInput = (
      <Input
        value={(clientFilterColumn.getFilterValue() as string) ?? ""}
        onChange={(event) =>
          clientFilterColumn.setFilterValue(event.target.value)
        }
        placeholder={
          filter?.placeholder ?? t("ui.common.table.searchPlaceholder")
        }
        className="bg-card sm:max-w-xs"
      />
    );
  }

  return (
    <div className="space-y-4">
      {searchInput || toolbar ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {searchInput}
          {toolbar ? (
            <div className="flex items-center gap-2 sm:ml-auto">{toolbar}</div>
          ) : null}
        </div>
      ) : null}
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={header.column.columnDef.meta?.headerClassName}
                  >
                    {renderHeaderContent(header)}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <DataTableBody
              table={table}
              columns={effectiveColumns}
              loading={loading}
              emptyMessage={emptyMessage}
              rowClassName={rowClassName}
              totalRows={totalRows}
              onRowClick={onRowClick}
            />
          </TableBody>
        </Table>
        {table.getPageCount() > 1 ? (
          <div className="border-t border-border px-5 py-3.5">
            <DataTablePagination table={table} />
          </div>
        ) : null}
      </Card>
    </div>
  );
};
