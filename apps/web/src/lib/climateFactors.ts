import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type ClimateFactorRow = {
  periodStart: string;
  periodEnd: string;
  factor: number | null;
  isManual: boolean;
};

export type ClimateFactorOverview = {
  buildingId: string;
  postalCode: string | null;
  rows: ClimateFactorRow[];
};

/**
 * Klimafaktoren zu einer Abrechnung (eigener Zeitraum + Vorperiode,
 * falls vorhanden), für die Witterungsbereinigung.
 */
export const climateFactorsQueryOptions = (statementId: string) =>
  queryOptions({
    queryKey: ["climateFactors", statementId],
    queryFn: () =>
      api.get<ClimateFactorOverview>("/climate-factors", { statementId }),
  });
