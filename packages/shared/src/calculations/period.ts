import type { Period } from "../types/index.js";

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
