import type { Period, PeriodShare } from "../types/index.js";

/**
 * Verschiebt ein ISO-Datum (YYYY-MM-DD) um `days` Tage
 */
export const addDaysIso = (iso: string, days: number): string => {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  const t = new Date(Date.UTC(y, m, d + days));

  return t.toISOString().slice(0, 10);
};

/**
 * Tageszahl zwischen zwei ISO-Daten (inklusiv beide Seiten).
 * Reine Tage-Arithmetik ohne Zeitzonen-Probleme, weil wir mit
 * UTC-Mitternacht rechnen.
 */
export const daysBetween = (start: string, end: string): number => {
  const startMs = Date.UTC(
    Number(start.slice(0, 4)),
    Number(start.slice(5, 7)) - 1,
    Number(start.slice(8, 10)),
  );

  const endMs = Date.UTC(
    Number(end.slice(0, 4)),
    Number(end.slice(5, 7)) - 1,
    Number(end.slice(8, 10)),
  );

  return Math.round((endMs - startMs) / 86_400_000) + 1;
};

/**
 * Länge des Kalenderjahres, in dem ein ISO-Datum liegt: 366 im Schaltjahr,
 * sonst 365. Bezugsgröße überall dort, wo ein Perioden-Wert auf ein Jahr
 * hochgerechnet wird. Eine volle Schaltjahres-Periode ergibt so den
 * Faktor 1. Perioden über den Jahreswechsel folgen ihrem Startjahr.
 */
export const daysInYear = (iso: string): number => {
  const year = Number(iso.slice(0, 4));

  return daysBetween(`${year}-01-01`, `${year}-12-31`);
};

/**
 * Schnittmenge zweier Perioden.
 *
 * @returns null, wenn kein Overlap.
 */
export const intersect = (a: Period, b: Period): Period | null => {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;

  if (start > end) {
    return null;
  }

  return { start, end };
};

/**
 * Anteil einer Rechnung, der in die Abrechnungsperiode fällt.
 * Linear nach Tagen.
 *
 * Beispiel: Rechnung 01.08.2024 - 31.07.2025 (365 Tage),
 * Abrechnung 01.01.2025 - 31.12.2025.
 * Overlap: 01.01.2025 - 31.07.2025 = 212 Tage.
 * Anteil: 212 / 365 = 0,5808.
 *
 * @returns Wert im Bereich 0...1
 */
export const prorationFactor = (
  invoicePeriod: Period,
  statementPeriod: Period,
): number => {
  const overlap = intersect(invoicePeriod, statementPeriod);
  if (!overlap) {
    return 0;
  }
  const overlapDays = daysBetween(overlap.start, overlap.end);
  const invoiceDays = daysBetween(invoicePeriod.start, invoicePeriod.end);
  return overlapDays / invoiceDays;
};

/**
 * Monatsgrenze: der erste Tag, der nicht mehr zum `months`-ten Monat ab
 * `periodStart` gehört. Der Tag trägt im Zielmonat die Zahl des Anfangstags;
 * gibt es ihn dort nicht, ist es der Erste des Monats danach (ein Monat ab
 * dem 31.01. endet am letzten Februartag). Immer vom Anfangstag aus gezählt,
 * nie von der vorigen Grenze, und immer ein gültiges Kalenderdatum.
 */
export const monthBoundary = (periodStart: string, months: number): string => {
  const year = Number(periodStart.slice(0, 4));
  const monthIndex = Number(periodStart.slice(5, 7)) - 1 + months;
  const day = Number(periodStart.slice(8, 10));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, monthIndex + 1, 0),
  ).getUTCDate();
  const boundary =
    day <= lastDayOfTargetMonth
      ? Date.UTC(year, monthIndex, day)
      : Date.UTC(year, monthIndex + 1, 1);

  return new Date(boundary).toISOString().slice(0, 10);
};

/**
 * Zählt die Monate eines Zeitraums vom Anfangstag aus: vollständig
 * enthaltene Monate, die Resttage danach und die Länge des Monats, in den
 * der Rest fällt. `null` ab zwölf Monaten (volles Jahr).
 */
export const countPeriodMonths = (
  period: Period,
): { fullMonths: number; restDays: number; nextMonthDays: number } | null => {
  const endExclusive = addDaysIso(period.end, 1);
  if (endExclusive >= monthBoundary(period.start, 12)) {
    return null;
  }

  let fullMonths = 0;
  while (monthBoundary(period.start, fullMonths + 1) <= endExclusive) {
    fullMonths++;
  }
  const lastBoundary = monthBoundary(period.start, fullMonths);
  // daysBetween zählt beide Enden mit, hier ist das Ende ausgeschlossen
  const daysUntil = (iso: string) => daysBetween(lastBoundary, iso) - 1;

  return {
    fullMonths,
    restDays: daysUntil(endExclusive),
    nextMonthDays: daysUntil(monthBoundary(period.start, fullMonths + 1)),
  };
};

const greatestCommonDivisor = (a: number, b: number): number =>
  b === 0 ? a : greatestCommonDivisor(b, a % b);

/**
 * Anteil eines Abrechnungszeitraums unter einem Jahr am Jahr: Monate
 * geteilt durch 12, der Rest nach den vollen Monaten als Bruchteil des
 * folgenden Monats. Acht Monate ergeben genau 2/3. `null` beim vollen Jahr.
 */
export const periodShareOfYear = (period: Period): PeriodShare | null => {
  const months = countPeriodMonths(period);
  if (!months) {
    return null;
  }

  const numerator = months.fullMonths * months.nextMonthDays + months.restDays;
  const denominator = 12 * months.nextMonthDays;
  const divisor = greatestCommonDivisor(numerator, denominator);

  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
};
