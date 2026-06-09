import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type Unit = {
  id: string;
  buildingId: string;
  name: string;
  unitNumber: string | null;
  areaSqm: number;
  heatingAreaSqm: number | null;
  updatedAt?: string;
};

export type UnitOccupancy = {
  status: "rented" | "vacant" | "vacant_from" | "owner";
  vacantFrom: string | null;
  tenantId: string | null;
  tenantNames: string[];
  commercial: boolean;
};

export type UnitOverviewRow = Unit & { occupancy: UnitOccupancy };

export type UnitSortColumn = "name" | "areaSqm" | "status" | "tenant";

export type UnitsOverviewParams = {
  page: number;
  pageSize: number;
  sort?: UnitSortColumn;
  order?: "asc" | "desc";
  q?: string;
  buildingId?: string;
};

export type UnitsOverviewResult = {
  items: UnitOverviewRow[];
  total: number;
  rentedCount: number;
};

export const unitsQueryOptions = queryOptions({
  queryKey: ["units"],
  queryFn: () =>
    api
      .get<UnitsOverviewResult>("/units", { pageSize: "1000" })
      .then((result) => result.items),
});

export const unitQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["unit", id],
    queryFn: () => api.get<Unit>(`/units/${id}`),
  });

export const unitsOverviewQueryOptions = (params: UnitsOverviewParams) =>
  queryOptions({
    queryKey: ["units", "page", params],
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

      return api.get<UnitsOverviewResult>(`/units?${search.toString()}`);
    },
    placeholderData: (prev) => prev,
  });
