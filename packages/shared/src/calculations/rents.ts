import { pad2 } from "../date.js";
import { daysBetween, intersect } from "./period.js";

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

export type MonthlyRentTarget = {
  baseRentCents: number;
  advanceCents: number;
};

const OPEN_END = "9999-12-31";

/**
 * Monats-Soll eines Vertrags für einen `YYYY-MM`-Key. Ein angebrochener
 * Monat (Einzug, Auszug oder Mietsatzwechsel mitten im Monat) zählt
 * anteilig nach Kalendertagen: Monatsbetrag x Miettage / Tage des Monats,
 * Kaltmiete und Vorauszahlung getrennt auf ganze Cent gerundet.
 *
 * @returns undefined, wenn im Monat kein Tag mit Mietsatz im Vertrag liegt.
 */
export const rentTargetForMonth = <
  T extends RentDateRange & {
    monthlyBaseRentCents: number;
    monthlyAdvanceCents: number;
  },
>(
  rents: T[],
  contract: { startDate: string; endDate: string | null },
  monthKey: string,
): MonthlyRentTarget | undefined => {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const contractInMonth = intersect(
    { start: contract.startDate, end: contract.endDate ?? OPEN_END },
    { start: `${monthKey}-01`, end: `${monthKey}-${pad2(daysInMonth)}` },
  );
  if (!contractInMonth) {
    return;
  }

  let coveredDays = 0;
  let baseRentCentDays = 0;
  let advanceCentDays = 0;

  for (const rent of rents) {
    const overlap = intersect(
      {
        start: rent.startDate ?? contract.startDate,
        end: rent.endDate ?? OPEN_END,
      },
      contractInMonth,
    );
    if (!overlap) {
      continue;
    }

    const days = daysBetween(overlap.start, overlap.end);
    coveredDays += days;
    baseRentCentDays += rent.monthlyBaseRentCents * days;
    advanceCentDays += rent.monthlyAdvanceCents * days;
  }

  if (coveredDays === 0) {
    return;
  }

  return {
    baseRentCents: Math.round(baseRentCentDays / daysInMonth),
    advanceCents: Math.round(advanceCentDays / daysInMonth),
  };
};
