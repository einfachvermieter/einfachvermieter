import { formatDate } from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import { t } from "./i18n";

export type AllocationKey =
  | "per_living_area"
  | "per_heating_area"
  | "per_person"
  | "per_unit"
  | "per_consumption_m3"
  | "per_consumption_kwh"
  | "heating_ordinance"
  | "fixed";

export type CostTypeAllocationKey = Exclude<AllocationKey, "heating_ordinance">;

export type CostTypeCategory = "operating" | "heating";

export type LaborCostCategory = "craftsman" | "household_service";

export type CostType = {
  id: string;
  buildingId: string;
  name: string;
  category: CostTypeCategory;
  defaultAllocationKey: CostTypeAllocationKey | null;
  laborCostCategory: LaborCostCategory | null;
  description: string | null;

  /**
   * Brennstoff-Kostenart mit CO2-Erfassung (nur bei category "heating").
   */
  co2Tracked: boolean;

  /**
   * Erfassungs-/Abrechnungsentgelt nach § 6a Abs. 3 Nr. 1c HeizkostenV
   * (nur bei category "heating").
   */
  isMeteringServiceCost: boolean;

  updatedAt?: string;
};

export type CostTypeStats = {
  year: number;
  entryCount: number;
  totalAmountCents: number;
  assignedMetersCount: number;
  lastEntry: { id: string; invoiceDate: string; amountCents: number } | null;
};

export type CostTypeDetail = CostType & { stats: CostTypeStats };

export type CostEntry = {
  id: string;
  invoiceDate: string;
  invoiceNumber: string | null;
  vendor: string | null;
  notes: string | null;
};

export type CostEntryItem = {
  id: string;
  costTypeId: string;
  costTypeName: string;
  amountCents: number;
  unitPriceCents: number | null;
  laborCostsCents: number | null;
  periodStart: string;
  periodEnd: string;
  position: number;
  /**
   * CO2-Menge in Gramm (Integer); im UI in kg dargestellt.
   */
  co2AmountGrams: number | null;
  /**
   * Im amountCents enthaltener CO2-Kostenanteil in Cent.
   */
  co2CostCents: number | null;
  /**
   * Enthaltene Steuern, Abgaben und Zölle in Cent
   */
  containedTaxesCents: number | null;
  /**
   * Arten der enthaltenen Steuern und Abgaben
   */
  containedTaxKinds: string[] | null;
};

export type CostEntryDetail = CostEntry & {
  updatedAt: string;
  items: CostEntryItem[];
};

export type CostEntryOverviewRow = {
  id: string;
  invoiceDate: string;
  invoiceNumber: string | null;
  vendor: string | null;
  notes: string | null;
  amountCents: number;
  periodStart: string;
  periodEnd: string;
  costTypeNames: string[];
  buildingId: string;
};

const allocationLabelKey: Record<AllocationKey, string> = {
  // biome-ignore-start lint/style/useNamingConvention: domain bedingte keys
  per_living_area: "costs.allocations.perLivingArea",
  per_heating_area: "costs.allocations.perHeatingArea",
  per_person: "costs.allocations.perPerson",
  per_unit: "costs.allocations.perUnit",
  per_consumption_m3: "costs.allocations.perConsumptionM3",
  per_consumption_kwh: "costs.allocations.perConsumptionKwh",
  heating_ordinance: "costs.allocations.heizkostenV",
  // biome-ignore-end lint/style/useNamingConvention: domain bedingte keys
  fixed: "costs.allocations.fixed",
};

export const allocationLabel = (key: AllocationKey): string =>
  t(allocationLabelKey[key]);

export type AllocationKeyGroup = {
  labelKey: string;
  keys: readonly CostTypeAllocationKey[];
};

export const allocationKeyGroups: readonly AllocationKeyGroup[] = [
  {
    labelKey: "costs.allocationGroups.byShare",
    keys: ["per_living_area", "per_heating_area", "per_person", "per_unit"],
  },
  {
    labelKey: "costs.allocationGroups.byConsumption",
    keys: ["per_consumption_m3"],
  },
  {
    labelKey: "costs.allocationGroups.other",
    keys: ["fixed"],
  },
];

export const costTypeCategoryLabel = (category: CostTypeCategory): string =>
  t(`costs.categories.${category}`);

export const laborCostCategoryLabel = (category: LaborCostCategory): string =>
  t(`ui.costs.laborCostCategoryOptions.${category}`);

export type CostCategory = "byShare" | "byConsumption" | "heating";

export const costCategoryFor = (
  category: CostTypeCategory,
  key: CostTypeAllocationKey | null,
): CostCategory => {
  if (category === "heating") {
    return "heating";
  }

  if (key === "per_consumption_m3" || key === "per_consumption_kwh") {
    return "byConsumption";
  }

  return "byShare";
};

export type CostTypeSortColumn = "name" | "category";

export type CostTypesOverviewParams = {
  page: number;
  pageSize: number;
  sort?: CostTypeSortColumn;
  order?: "asc" | "desc";
  q?: string;
  buildingId?: string;
};

export type CostTypesOverviewResult = {
  items: CostType[];
  total: number;
};

/**
 * Unpaginierte Liste
 * Für Auswahl-Dropdowns (z. B. Rechnung anlegen,
 * Zähler)
 */
export const costTypesQueryOptions = queryOptions({
  queryKey: ["costTypes"],
  queryFn: () => api.get<CostType[]>("/costs/types"),
});

export const costTypeQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["costType", id],
    queryFn: () => api.get<CostTypeDetail>(`/costs/types/${id}`),
  });

export const costTypesOverviewQueryOptions = (
  params: CostTypesOverviewParams,
) =>
  queryOptions({
    queryKey: ["costTypes", "page", params],
    queryFn: () => {
      const search = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      });

      if (params.sort) {
        search.set("sort", params.sort);
      }

      if (params.order) {
        search.set("order", params.order);
      }

      if (params.q) {
        search.set("q", params.q);
      }

      if (params.buildingId) {
        search.set("buildingId", params.buildingId);
      }

      return api.get<CostTypesOverviewResult>(
        `/costs/types?${search.toString()}`,
      );
    },
    placeholderData: (prev) => prev,
  });

export type CostEntrySortColumn =
  | "invoiceDate"
  | "amount"
  | "vendor"
  | "period";

export type CostEntriesOverviewParams = {
  page: number;
  pageSize: number;
  sort?: CostEntrySortColumn;
  order?: "asc" | "desc";
  q?: string;
  buildingId?: string;
};

export type CostEntriesOverviewResult = {
  items: CostEntryOverviewRow[];
  total: number;
  totalAmountCents: number;
};

export const costEntriesOverviewQueryOptions = (
  params: CostEntriesOverviewParams,
) =>
  queryOptions({
    queryKey: ["costs", "page", params],
    queryFn: () => {
      const search = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      });

      if (params.sort) {
        search.set("sort", params.sort);
      }

      if (params.order) {
        search.set("order", params.order);
      }

      if (params.q) {
        search.set("q", params.q);
      }

      if (params.buildingId) {
        search.set("buildingId", params.buildingId);
      }

      return api.get<CostEntriesOverviewResult>(`/costs?${search.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

export const costEntryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["costEntry", id],
    queryFn: () => api.get<CostEntryDetail>(`/costs/${id}`),
  });

/**
 * Identifizierende Bezeichnung einer Lieferantenrechnung für Überschrift,
 * Breadcrumb und Tab-Titel
 */
export const costEntryIdentityLabel = (
  entry: Pick<CostEntry, "invoiceDate">,
): string =>
  t("ui.invoices.identityTitleNoVendor", {
    date: formatDate(entry.invoiceDate),
  });
