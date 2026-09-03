import { monthKeyOf } from "@einfachvermieter/i18n";
import { todayIso } from "@einfachvermieter/shared";
import { t } from "@/lib/i18n";

/**
 * Monat (YYYY-MM) als Name, mit Jahr nur bei abweichendem Jahr:
 * "Juli" im laufenden Jahr, sonst "Juli 2025"
 */
export const monthLabel = (month: string): string => {
  if (month.length < 7) {
    return "";
  }

  const name = t(`common.months.${monthKeyOf(Number(month.slice(5, 7)))}`);
  const year = month.slice(0, 4);

  return year === todayIso().slice(0, 4)
    ? name
    : t("ui.dashboard.monthYear", { month: name, year });
};

/**
 * Kurzform für die Achse des Diagramms ("Jul")
 */
export const monthLabelShort = (month: string): string =>
  t(`common.monthsShort.${monthKeyOf(Number(month.slice(5, 7)))}`);
