import {
  parseEurToCents,
  RENT_CHANGE_REASON_NONE,
} from "@einfachvermieter/shared";
import { Badge } from "@/components/ui/Badge";
import { formatPeriod, getPeriodStatusToday } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";
import type { RentRowValues } from "./rentRow";

/**
 * Zahl mit Vorzeichen, außer bei 0
 */
const signed = (value: number, digits: number): string =>
  value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  });

/**
 * Veränderung gegenüber dem vorigen Mietsatz: Kaltmiete in Euro und
 * Prozent, oder der Hinweis, dass sich nur die Vorauszahlung geändert hat
 */
const changeLabel = (
  row: RentRowValues,
  previous: RentRowValues | undefined,
): string | null => {
  if (!previous) {
    return null;
  }

  const previousCents = parseEurToCents(previous.monthlyBaseRentEuros);
  const deltaCents = parseEurToCents(row.monthlyBaseRentEuros) - previousCents;
  if (deltaCents !== 0) {
    const amount = signed(deltaCents / 100, 2);
    return previousCents > 0
      ? t("ui.tenant.rentDelta", {
          amount,
          percent: signed((deltaCents / previousCents) * 100, 1),
        })
      : t("ui.tenant.rentDeltaAmount", { amount });
  }

  return row.monthlyAdvanceEuros !== previous.monthlyAdvanceEuros
    ? t("ui.tenant.rentAdvanceAdjusted")
    : null;
};

/**
 * Zusammenfassung eines Mietsatzes in der Verlaufsliste: Beträge, Kennzeichen
 * für den heute gültigen bzw. letzten Satz, Änderungsgrund, Veränderung zum
 * Vorgänger, Gültigkeitszeitraum und Notiz
 */
export const RentRowSummary = ({
  row,
  previous,
  index,
  tenantStartDate,
  tenantEndDate,
}: {
  row: RentRowValues;
  /**
   * Zeitlich voriger Mietsatz, fehlt beim ersten
   */
  previous: RentRowValues | undefined;
  index: number;
  tenantStartDate: string;
  tenantEndDate: string;
}) => {
  const effectiveStart = row.startDate || tenantStartDate;
  const effectiveEnd = row.endDate || tenantEndDate;
  const periodStatus = getPeriodStatusToday(
    effectiveStart,
    effectiveEnd,
    tenantEndDate,
  );
  const change = changeLabel(row, previous);
  const period = formatPeriod(effectiveStart, effectiveEnd);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate font-semibold tabular-nums">
          {row.monthlyBaseRentEuros
            ? `${row.monthlyBaseRentEuros} € + ${row.monthlyAdvanceEuros || "0,00"} €`
            : t("ui.tenant.rentIndex", { index: index + 1 })}
        </p>
        {periodStatus === "active" ? (
          <Badge variant="ok">{t("ui.tenant.rentCurrent")}</Badge>
        ) : null}
        {periodStatus === "last" ? (
          <Badge variant="warn">{t("ui.tenant.lastRent")}</Badge>
        ) : null}
        {row.changeReason !== RENT_CHANGE_REASON_NONE ? (
          <Badge variant="tag">
            {t(`tenants.rentChangeReasons.${row.changeReason}`)}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {change
          ? t("ui.tenant.rentPeriodWithChange", { period, change })
          : period}
      </p>
      {row.changeNote ? (
        <p className="text-sm text-muted-foreground">{row.changeNote}</p>
      ) : null}
    </>
  );
};
