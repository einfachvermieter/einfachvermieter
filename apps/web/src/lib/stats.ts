import type { StatsResult } from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type { StatsResult };

export const statsQueryOptions = queryOptions({
  queryKey: ["stats"],
  queryFn: () => api.get<StatsResult>("/stats"),
});
