import { formatDate, formatEur } from "@einfachvermieter/shared";
import type { ComponentProps } from "react";
import { MiniKpiRow } from "@/components/common/MiniKpiRow";
import { t } from "@/lib/i18n";
import type { DashboardResult } from "@/lib/stats";
import { monthLabel } from "../monthLabel";

/**
 * Die drei Kennzahlen der Übersicht: Stand der Abrechnungen samt Frist,
 * Rückstände und die Mieteingänge des laufenden Monats
 */
export const DashboardKpis = ({ data }: { data: DashboardResult }) => {
  const openStatements = data.statementsTotal - data.statementsDone;
  const currentMonth = data.months.at(-1);
  const openThisMonth = currentMonth
    ? Math.max(0, currentMonth.targetCents - currentMonth.receivedCents)
    : 0;
  const hasRent = data.months.some((month) => month.targetCents > 0);

  const statementHint = () => {
    if (openStatements === 0) {
      return t("ui.dashboard.kpi.statementsHintDone", {
        deadline: formatDate(data.statementDeadline),
      });
    }
    if (data.daysUntilDeadline < 0) {
      return t("ui.dashboard.kpi.statementsHintOverdue", {
        total: data.statementsTotal,
        deadline: formatDate(data.statementDeadline),
      });
    }
    return t("ui.dashboard.kpi.statementsHint", {
      total: data.statementsTotal,
      days: data.daysUntilDeadline,
    });
  };

  // Ohne Mietverhältnisse im Abrechnungsjahr bzw. ohne Sollmiete im
  // Zeitraum, wäre eine Null keine Aussage, sondern ein leerer Bestand.
  const items: ComponentProps<typeof MiniKpiRow>["items"] = [];

  if (data.statementsTotal > 0) {
    items.push({
      label: t("ui.dashboard.kpi.statements", { year: data.statementYear }),
      value:
        openStatements === 0
          ? t("ui.dashboard.kpi.statementsAllDone")
          : t("ui.dashboard.kpi.statementsOpen", { count: openStatements }),
      hint: statementHint(),
      tone: openStatements === 0 ? "neutral" : "warning",
    });
  }

  if (hasRent) {
    items.push({
      label: t("ui.dashboard.kpi.overdue"),
      value: formatEur(data.overdueTotalCents),
      hint:
        data.overdueTenants.length === 0
          ? t("ui.dashboard.kpi.overdueNone")
          : t("ui.dashboard.kpi.overdueHint", {
              count: data.overdueTenants.length,
              month: monthLabel(earliestOpenMonth(data)),
            }),
      tone: data.overdueTotalCents > 0 ? "bad" : "neutral",
    });
    items.push({
      label: t("ui.dashboard.kpi.intake", {
        month: currentMonth ? monthLabel(currentMonth.month) : "",
      }),
      value: formatEur(currentMonth?.receivedCents ?? 0),
      hint: t("ui.dashboard.kpi.intakeHint", {
        target: formatEur(currentMonth?.targetCents ?? 0),
      }),
      tone: openThisMonth > 0 ? "warning" : "neutral",
    });
  }

  if (items.length === 0) {
    return null;
  }

  return <MiniKpiRow columns={items.length as 1 | 2 | 3} items={items} />;
};

/**
 * Frühester Monat, in dem jemand etwas offen gelassen hat
 */
const earliestOpenMonth = (data: DashboardResult): string => {
  const months = data.overdueTenants
    .map((tenant) => tenant.sinceMonth)
    .filter((month): month is string => month !== null);

  return months.length === 0 ? "" : months.reduce((a, b) => (a < b ? a : b));
};
