import type { DashboardResult, StatsResult } from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type { StatsResult };

export const statsQueryOptions = (buildingId?: string) =>
  queryOptions({
    queryKey: ["stats", buildingId ?? "global"],
    queryFn: () =>
      api.get<StatsResult>(
        buildingId ? `/stats?buildingId=${buildingId}` : "/stats",
      ),
  });

export type { DashboardResult };

export const dashboardQueryOptions = queryOptions({
  queryKey: ["stats", "dashboard"],
  queryFn: () => api.get<DashboardResult>("/stats/dashboard"),
});
