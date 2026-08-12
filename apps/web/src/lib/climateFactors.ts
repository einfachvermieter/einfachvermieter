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
  autoFetch: boolean | null;
  rows: ClimateFactorRow[];
};

export type ClimateFactorsSettings = {
  autoFetch: boolean | null;
};

/**
 * Entscheidung, ob Klimafaktoren automatisch von opendata.dwd.de geladen
 * werden dürfen.
 */
export const climateFactorsSettingsQueryOptions = queryOptions({
  queryKey: ["climateFactorsSettings"],
  queryFn: () => api.get<ClimateFactorsSettings>("/settings/climate-factors"),
});

export const updateClimateFactorsAutoFetch = (autoFetch: boolean) =>
  api.patch<ClimateFactorsSettings>("/settings/climate-factors", { autoFetch });

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
