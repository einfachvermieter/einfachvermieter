/**
 * Monats-Schlüssel in Kalenderreihenfolge, passend zu `common.months`
 * (ausgeschrieben) und `common.monthsShort` (Kurzform) in den
 * Sprachdateien
 */
export const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export type MonthKey = (typeof MONTH_KEYS)[number];

/**
 * Schlüssel des Monats einer Monatsnummer (1-12)
 */
export const monthKeyOf = (month: number): MonthKey =>
  MONTH_KEYS[month - 1] ?? "jan";
