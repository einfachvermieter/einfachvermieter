import { todayIso } from "@einfachvermieter/shared";

const isPeriodActiveOn = (
  start: string,
  end: string,
  refDate: string,
): boolean => {
  if (!start) {
    return false;
  }

  if (start > refDate) {
    return false;
  }

  if (end && end < refDate) {
    return false;
  }

  return true;
};

/**
 * Prüft, ob das Intervall [start, end] (ISO-Daten) den heutigen Tag
 * abdeckt. Leeres `start` -> false. Leeres `end` -> offenes Ende.
 */
export const isPeriodActiveToday = (start: string, end: string): boolean =>
  isPeriodActiveOn(start, end, todayIso());

export type PeriodStatus = "active" | "last" | "none";

/**
 * Status eines Zeitraums im Bezug auf einen Vertragszeitraum:
 * - "active":  heute aktiv
 * - "last":    Vertrag liegt in der Vergangenheit und der Eintrag war
 *              am letzten Vertragstag aktiv (= "letzter Wert")
 * - "none":    keiner der beiden Fälle
 */
export const getPeriodStatusToday = (
  start: string,
  end: string,
  contractEnd: string,
): PeriodStatus => {
  const today = todayIso();
  if (isPeriodActiveOn(start, end, today)) {
    return "active";
  }

  if (
    contractEnd &&
    contractEnd < today &&
    isPeriodActiveOn(start, end, contractEnd)
  ) {
    return "last";
  }

  return "none";
};
