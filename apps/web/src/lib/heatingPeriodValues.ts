import type {
  HeatingPeriodValues,
  HeatingPeriodValuesWriteDto,
  Period,
} from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

const basePath = (buildingId: string) =>
  `/buildings/${buildingId}/heating/period-values`;

export const heatingPeriodValuesQueryOptions = (
  buildingId: string,
  period: Period,
) =>
  queryOptions({
    queryKey: ["heating-period-values", buildingId, period.start, period.end],
    queryFn: () =>
      api.get<HeatingPeriodValues>(basePath(buildingId), {
        periodStart: period.start,
        periodEnd: period.end,
      }),
  });

export const putHeatingPeriodValues = (
  buildingId: string,
  dto: HeatingPeriodValuesWriteDto,
) => api.put<HeatingPeriodValues>(basePath(buildingId), dto);
