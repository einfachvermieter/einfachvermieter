import { formatDate } from "@einfachvermieter/shared";
import { Badge } from "@/components/ui/Badge";
import { getPeriodStatusToday } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";
import type { RentRowValues } from "./rentRow";

/**
 * Zusammenfassung eines Mietsatzes in der Verlaufsliste: Beträge, Kennzeichen
 * für den heute gültigen bzw. letzten Satz und der Gültigkeitszeitraum
 */
export const RentRowSummary = ({
  row,
  index,
  tenantStartDate,
  tenantEndDate,
}: {
  row: RentRowValues;
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

  return (
    <>
      <div className="flex items-center gap-2">
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
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {t("ui.common.periodLabel", {
          start: effectiveStart ? formatDate(effectiveStart) : "?",
          end: effectiveEnd
            ? formatDate(effectiveEnd)
            : t("ui.tenant.openEnded"),
        })}
      </p>
    </>
  );
};
