/**
 * Heutiges Datum als ISO `YYYY-MM-DD` (UTC).
 */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * Zahl zweistellig mit führender Null (für `YYYY-MM`-Keys)
 */
export const pad2 = (value: number): string =>
  value.toString().padStart(2, "0");

/**
 * Zahl vierstellig mit führenden Nullen (für ISO-Jahresanteile)
 */
export const pad4 = (value: number): string =>
  value.toString().padStart(4, "0");

/**
 * Frühestes von mehreren ISO-Daten
 */
export const minDate = (...dates: string[]): string =>
  dates.reduce((acc, date) => (date < acc ? date : acc));

/**
 * Spätestes von mehreren ISO-Daten
 */
export const maxDate = (...dates: string[]): string =>
  dates.reduce((acc, date) => (date > acc ? date : acc));

/**
 * ISO `YYYY-MM-DD` in Object zerlegen
 */
export const splitIsoDate = (
  iso: string,
): { year: number; month: number; day: number } => {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y ?? 0, month: m ?? 0, day: d ?? 0 };
};

type EnumerateMonthsOptions = {
  /**
   * - `"ym"`      -> `"YYYY-MM"` (Default)
   * - `"ymStart"` -> `"YYYY-MM-01"` (Monatsanfänge, für Lock-Helper)
   */
  as?: "ym" | "ymStart";
};

/**
 * Erzeugt eine Liste von Monats-Keys für alle Kalendermonate zwischen
 * `start` und `end` (inklusive Start- und End-Monat). Tag-Anteil der
 * Eingaben wird ignoriert.
 */
export const enumerateMonths = (
  startIso: string,
  endIso: string,
  opts: EnumerateMonthsOptions = {},
): string[] => {
  const { as = "ym" } = opts;
  const { year: startYear, month: startMonth } = splitIsoDate(startIso);
  const { year: endYear, month: endMonth } = splitIsoDate(endIso);
  const result: string[] = [];

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key =
      as === "ymStart"
        ? `${pad4(year)}-${pad2(month)}-01`
        : `${pad4(year)}-${pad2(month)}`;
    result.push(key);

    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return result;
};
