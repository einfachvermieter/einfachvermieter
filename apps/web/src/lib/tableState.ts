import type {
  OnChangeFn,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

const PAGE_SIZE_STORAGE_PREFIX = "table:pageSize:";
const ALLOWED_PAGE_SIZES = new Set<number>([25, 50, 100]);

const readPersistedPageSize = (
  storageKey: string | undefined,
  fallback: number,
): number => {
  if (!storageKey || typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(
      `${PAGE_SIZE_STORAGE_PREFIX}${storageKey}`,
    );

    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);

    return ALLOWED_PAGE_SIZES.has(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writePersistedPageSize = (storageKey: string, value: number) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      `${PAGE_SIZE_STORAGE_PREFIX}${storageKey}`,
      String(value),
    );
  } catch {
    // localStorage ist ggf. nicht verfügbar; Persistenz ist Best-Effort
  }
};

type UseServerTableStateOptions<TSort extends string> = {
  allowedSorts: ReadonlySet<TSort>;
  defaultSort: TSort;
  defaultOrder?: "asc" | "desc";
  defaultPageSize?: number;
  storageKey?: string;
};

/**
 * Server-Query-Parameter im Shape, den die `*OverviewQueryOptions` erwarten.
 */
export type ServerTableQueryParams<TSort extends string> = {
  page: number;
  pageSize: number;
  sort: TSort | undefined;
  order: "asc" | "desc";
  q: string | undefined;
};

/**
 * Handler/State-Felder fuer das `server`-Prop der `DataTable` (ohne pageCount).
 */
export type ServerTableProps = {
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  search: string;
  onSearchChange: (value: string) => void;
};

export type ServerTableState<TSort extends string> = {
  pagination: PaginationState;
  setPagination: OnChangeFn<PaginationState>;
  sorting: SortingState;
  setSorting: OnChangeFn<SortingState>;
  search: string;
  setSearch: (value: string) => void;
  sortColumn: TSort | undefined;
  order: "asc" | "desc";
  queryParams: ServerTableQueryParams<TSort>;
  serverProps: ServerTableProps;
  pageCount: (total: number) => number;
};

export const useServerTableState = <TSort extends string>({
  allowedSorts,
  defaultSort,
  defaultOrder = "asc",
  defaultPageSize = 25,
  storageKey,
}: UseServerTableStateOptions<TSort>): ServerTableState<TSort> => {
  const [pagination, _setPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: readPersistedPageSize(storageKey, defaultPageSize),
  }));
  const setPagination: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      _setPagination((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;

        if (storageKey && next.pageSize !== prev.pageSize) {
          writePersistedPageSize(storageKey, next.pageSize);
        }

        return next;
      });
    },
    [storageKey],
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: defaultSort, desc: defaultOrder === "desc" },
  ]);

  const [search, setSearchState] = useState("");

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    _setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const [sortSpec] = sorting;
  const sortColumn =
    sortSpec && allowedSorts.has(sortSpec.id as TSort)
      ? (sortSpec.id as TSort)
      : undefined;
  const order: "asc" | "desc" = sortSpec?.desc ? "desc" : "asc";

  const queryParams = useMemo<ServerTableQueryParams<TSort>>(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sortColumn,
      order,
      q: search.trim() || undefined,
    }),
    [pagination.pageIndex, pagination.pageSize, sortColumn, order, search],
  );

  const serverProps = useMemo<ServerTableProps>(
    () => ({
      pagination,
      onPaginationChange: setPagination,
      sorting,
      onSortingChange: setSorting,
      search,
      onSearchChange: setSearch,
    }),
    [pagination, setPagination, sorting, search, setSearch],
  );

  const pageCount = useCallback(
    (total: number) => Math.max(1, Math.ceil(total / pagination.pageSize)),
    [pagination.pageSize],
  );

  return {
    pagination,
    setPagination,
    sorting,
    setSorting,
    search,
    setSearch,
    sortColumn,
    order,
    queryParams,
    serverProps,
    pageCount,
  };
};
