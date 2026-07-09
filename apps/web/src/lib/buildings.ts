import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type Building = {
  id: string;
  name: string;
  addressStreet: string;
  addressPostalCode: string;
  addressCity: string;
  unitsCount: number;
  /**
   * Mietverhältnisse mit laufendem Vertrag (Stichtag heute)
   */
  activeTenantsCount: number;
  updatedAt?: string;
};

export type BuildingSortColumn =
  | "name"
  | "addressStreet"
  | "addressPostalCode"
  | "addressCity";

export type BuildingsOverviewParams = {
  page: number;
  pageSize: number;
  sort?: BuildingSortColumn;
  order?: "asc" | "desc";
  q?: string;
};

export type BuildingsOverviewResult = {
  items: Building[];
  total: number;
};

export const buildingsQueryOptions = queryOptions({
  queryKey: ["buildings"],
  queryFn: () =>
    api
      .get<BuildingsOverviewResult>("/buildings?pageSize=1000")
      .then((result) => result.items),
});

export const buildingQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["building", id],
    queryFn: () => api.get<Building>(`/buildings/${id}`),
  });

export const buildingsOverviewQueryOptions = (
  params: BuildingsOverviewParams,
) =>
  queryOptions({
    queryKey: ["buildings", "page", params],
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

      return api.get<BuildingsOverviewResult>(
        `/buildings?${search.toString()}`,
      );
    },
    placeholderData: (prev) => prev,
  });
