export type RentDateRange = {
  /**
   * `null` = ab Vertragsbeginn.
   */
  startDate: string | null;
  /**
   * `null` = bis Vertragsende.
   */
  endDate: string | null;
};

/**
 * Erster Eintrag, dessen `[startDate, endDate]`-Fenster (null = offen) das
 * Datum abdeckt. Erwartet die Historie aufsteigend nach `startDate`
 * sortiert. Bei Überlappungen gewinnt der frühere Eintrag.
 */
export const pickRentForDate = <T extends RentDateRange>(
  rents: T[],
  date: string,
): T | undefined => {
  for (const rent of rents) {
    const startsBefore = !rent.startDate || rent.startDate <= date;
    const endsAfter = !rent.endDate || rent.endDate >= date;

    if (startsBefore && endsAfter) {
      return rent;
    }
  }
};

/**
 * Wie `pickRentForDate`, bezogen auf den Monatsanfang eines `YYYY-MM`-Keys.
 */
export const pickRentForMonth = <T extends RentDateRange>(
  rents: T[],
  monthKey: string,
): T | undefined => pickRentForDate(rents, `${monthKey}-01`);
