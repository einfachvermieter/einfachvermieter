/**
 * Teilnahme der Wohnungen an der zentralen Heizung und am zentralen
 * Warmwasser. Erfasst wird nur die Ausnahme: Zeiträume, in denen eine
 * Wohnung technisch nicht aus der zentralen Anlage versorgt wird. Die
 * Versorgung ist unabhängig von der Belegung; beide werden erst bei der
 * Kostenaufteilung kombiniert.
 */

import type { Period, ReadingPoint } from "../types/index.js";
import {
  type BoundaryKind,
  classifyPeriodBoundaries,
  hasResetBetween,
} from "./meters.js";
import { addDaysIso, daysBetween, intersect } from "./period.js";

export type SupplyScope = "heating" | "hot_water";

/**
 * Zeitraum ohne Versorgung aus der zentralen Anlage
 */
export type SupplyExclusion = {
  unitId: string;
  scope: SupplyScope;
  validFrom: string;
  validUntil: string | null;
};

/**
 * Versorgter Zeitraum innerhalb der Periode. Eine Grenze ist gesetzt, wenn
 * der Tag davor bzw. danach nicht versorgt ist; nur dort muss versorgter
 * Verbrauch gegen nicht versorgte Zeit abgegrenzt werden.
 */
export type SuppliedPeriod = Period & {
  startIsBoundary: boolean;
  endIsBoundary: boolean;
};

/**
 * Versorgte Zeiträume je Wohnung. Wohnungen ohne Eintrag sind die ganze
 * Periode versorgt.
 */
export type UnitSupply = Map<string, SuppliedPeriod[]>;

const OPEN_END = "9999-12-31";

/**
 * Versorgte Zeiträume einer Wohnung in der Periode, rein technisch und
 * ohne Blick auf die Belegung
 */
export const suppliedPeriods = (
  exclusions: SupplyExclusion[],
  unitId: string,
  scope: SupplyScope,
  period: Period,
): SuppliedPeriod[] => {
  const own = exclusions
    .filter((entry) => entry.unitId === unitId && entry.scope === scope)
    .map((entry) => ({
      start: entry.validFrom,
      end: entry.validUntil ?? OPEN_END,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const isExcluded = (date: string): boolean =>
    own.some((entry) => entry.start <= date && date <= entry.end);

  const spans: Period[] = [];
  let cursor = period.start;
  for (const entry of own) {
    if (entry.end < cursor || entry.start > period.end) {
      continue;
    }

    if (entry.start > cursor) {
      spans.push({ start: cursor, end: addDaysIso(entry.start, -1) });
    }

    if (entry.end >= period.end) {
      cursor = OPEN_END;
      break;
    }
    cursor = addDaysIso(entry.end, 1);
  }
  if (cursor <= period.end) {
    spans.push({ start: cursor, end: period.end });
  }

  return spans.map((span) => ({
    ...span,
    startIsBoundary: isExcluded(addDaysIso(span.start, -1)),
    endIsBoundary: isExcluded(addDaysIso(span.end, 1)),
  }));
};

export const daysOfPeriods = (periods: Period[]): number =>
  periods.reduce((acc, entry) => acc + daysBetween(entry.start, entry.end), 0);

/**
 * Schnittmenge zweier Listen von Zeiträumen
 */
export const intersectPeriods = (first: Period[], second: Period[]): Period[] =>
  first.flatMap((a) =>
    second.flatMap((b) => {
      const overlap = intersect(a, b);

      return overlap ? [overlap] : [];
    }),
  );

/**
 * Versorgte Zeiträume aller Wohnungen eines Bereichs
 */
export const buildUnitSupply = (
  exclusions: SupplyExclusion[],
  unitIds: string[],
  scope: SupplyScope,
  period: Period,
): UnitSupply =>
  new Map(
    unitIds.map((unitId) => [
      unitId,
      suppliedPeriods(exclusions, unitId, scope, period),
    ]),
  );

export type SupplyState = "full" | "partial" | "none";

/**
 * Ob eine Wohnung die ganze Periode, teilweise oder gar nicht versorgt ist
 */
export const supplyStateOf = (
  supply: UnitSupply | undefined,
  unitId: string,
  period: Period,
): SupplyState => {
  const periods = supply?.get(unitId);
  if (!periods) {
    return "full";
  }

  const days = daysOfPeriods(periods);
  if (days === 0) {
    return "none";
  }

  return days === daysBetween(period.start, period.end) ? "full" : "partial";
};

/**
 * Versorgte Zeiträume einer Wohnung; ohne Angabe die ganze Periode
 */
export const suppliedPeriodsOf = (
  supply: UnitSupply | undefined,
  unitId: string | null,
  period: Period,
): SuppliedPeriod[] =>
  (unitId === null ? undefined : supply?.get(unitId)) ?? [
    { ...period, startIsBoundary: false, endIsBoundary: false },
  ];

/**
 * Ablesungen eines Zählers für einen versorgten Zeitraum. An einer
 * Versorgungsgrenze zählt eine echte Ablesung am Nachbartag jenseits der
 * Grenze wie eine Ablesung am Grenztag (wie 31.12. und 01.01. am
 * Periodenwechsel). Beginnt die Versorgung am Tag nach dem Stichtag eines
 * Heizkostenverteilers, steht das Gerät auf 0.
 */
export const readingsForSuppliedPeriod = (
  readings: ReadingPoint[],
  supplied: SuppliedPeriod,
  resetDay?: string | null,
): ReadingPoint[] => {
  const result = [...readings];
  const at = (date: string) => readings.find((entry) => entry.date === date);

  if (supplied.startIsBoundary && !at(supplied.start)) {
    const dayBefore = addDaysIso(supplied.start, -1);
    const neighbor = at(dayBefore);

    if (hasResetBetween(resetDay, dayBefore, supplied.start)) {
      result.push({
        date: supplied.start,
        value: 0,
        isCumulative: true,
        isEstimated: false,
      });
    } else if (neighbor) {
      result.push({ ...neighbor, date: supplied.start });
    }
  }

  if (supplied.endIsBoundary && !at(supplied.end)) {
    const dayAfter = addDaysIso(supplied.end, 1);
    const neighbor = at(dayAfter);

    if (neighbor && !hasResetBetween(resetDay, supplied.end, dayAfter)) {
      result.push({ ...neighbor, date: supplied.end });
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Fehlende Stände eines versorgten Zeitraums. An einer Versorgungsgrenze
 * genügt nur eine echte Ablesung: Dort wird nicht interpoliert, weil der
 * Zähler nach der Trennung in der Regel keinen Verbrauch aus der zentralen
 * Anlage mehr erfasst. An den übrigen Rändern gilt die Regel der Periode.
 */
export const missingSupplyReadings = (
  readings: ReadingPoint[],
  supplied: SuppliedPeriod,
  resetDay?: string | null,
): Array<{ date: string; isSupplyBoundary: boolean }> => {
  const kinds = classifyPeriodBoundaries(
    readingsForSuppliedPeriod(readings, supplied, resetDay),
    supplied.start,
    supplied.end,
    resetDay,
  );
  const isMissing = (kind: BoundaryKind, isBoundary: boolean): boolean =>
    isBoundary ? kind !== "read" : kind === "missing";

  return [
    ...(isMissing(kinds.start, supplied.startIsBoundary)
      ? [{ date: supplied.start, isSupplyBoundary: supplied.startIsBoundary }]
      : []),
    ...(isMissing(kinds.end, supplied.endIsBoundary)
      ? [{ date: supplied.end, isSupplyBoundary: supplied.endIsBoundary }]
      : []),
  ];
};
