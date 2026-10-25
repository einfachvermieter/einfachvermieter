import type { Period } from "../types/index.js";
import { addDaysIso } from "./period.js";

/**
 * Abschnitte von `from` bis `to` (beide inklusiv), die keine Version der
 * Heizkostenkonfiguration abdeckt. Endet die letzte Version vor `to` ohne
 * Nachfolgerin, ist der Rest ein offener Abschnitt. Ohne Version ist der
 * ganze Zeitraum ein Abschnitt. Die Funktion kennt kein Tagesdatum; der
 * Zeitraum kommt immer vom Aufrufer.
 */
export const uncoveredHeatingConfigPeriods = (
  configs: ReadonlyArray<{ validFrom: string; validTo: string | null }>,
  from: string,
  to: string,
): Period[] => {
  const gaps: Period[] = [];
  const sorted = [...configs].sort((left, right) =>
    left.validFrom.localeCompare(right.validFrom),
  );

  /**
   * Erster Tag, den noch keine Version abdeckt; null, sobald eine Version
   * ohne Ende erreicht ist
   */
  let cursor: string | null = from;

  for (const config of sorted) {
    if (cursor === null || cursor > to) {
      break;
    }
    if (config.validFrom > cursor) {
      const gapEnd = addDaysIso(config.validFrom, -1);
      gaps.push({ start: cursor, end: gapEnd < to ? gapEnd : to });
    }
    if (config.validTo === null) {
      cursor = null;
    } else {
      const next = addDaysIso(config.validTo, 1);
      cursor = next > cursor ? next : cursor;
    }
  }

  if (cursor !== null && cursor <= to) {
    gaps.push({ start: cursor, end: to });
  }

  return gaps;
};
