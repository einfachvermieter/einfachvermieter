// Gemeinsames Parsen der Listen-Query-Parameter
// (`page`, `pageSize`, `sort`, `order`, `q`)

const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 25;

export type PaginationQueryInput = {
  page?: string;
  pageSize?: string;
  sort?: string;
  order?: string;
  q?: string;
};

export type ParsedPaginationQuery<TSort extends string> = {
  page: number;
  pageSize: number;
  sort: TSort | undefined;
  order: "asc" | "desc";
  q: string | undefined;
};

/**
 * Engt einen rohen Order-String auf "asc"/"desc" ein und faellt bei
 * ungueltigem Wert auf den uebergebenen Default zurueck.
 */
const resolveOrder = (
  order: string | undefined,
  defaultOrder: "asc" | "desc" = "asc",
): "asc" | "desc" => {
  if (order === "asc") {
    return "asc";
  }

  if (order === "desc") {
    return "desc";
  }

  return defaultOrder;
};

/**
 * Validiert und normalisiert die Paginierungs-Parameter
 */
export const parsePaginationQuery = <TSort extends string>(
  input: PaginationQueryInput,
  allowedSort: ReadonlySet<TSort>,
  defaultOrder: "asc" | "desc" = "asc",
): ParsedPaginationQuery<TSort> => ({
  page: Math.max(0, Number.parseInt(input.page ?? "0", 10) || 0),

  pageSize: Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(input.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  ),

  sort:
    input.sort && allowedSort.has(input.sort as TSort)
      ? (input.sort as TSort)
      : undefined,

  order: resolveOrder(input.order, defaultOrder),

  q: input.q?.trim() || undefined,
});
