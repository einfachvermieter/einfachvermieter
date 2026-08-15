import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { statementsQueryOptions } from "../../../../lib/statements";

export type SettledPeriod = { start: string; end: string };

/**
 * Zeiträume festgeschriebener Abrechnungen eines Gebäudes. Zählerstände darin
 * sind bereits abgerechnet; eine Änderung wirkt nur über eine Korrektur.
 */
export const useSettledPeriods = (buildingId: string): SettledPeriod[] => {
  const { data: statements } = useQuery(statementsQueryOptions);

  return useMemo(
    () =>
      (statements ?? [])
        .filter(
          (statement) =>
            statement.buildingId === buildingId &&
            statement.status === "finalized",
        )
        .map((statement) => ({
          start: statement.periodStart,
          end: statement.periodEnd,
        })),
    [statements, buildingId],
  );
};

export const isInSettledPeriod = (
  periods: SettledPeriod[],
  date: string,
): boolean =>
  periods.some((period) => date >= period.start && date <= period.end);
