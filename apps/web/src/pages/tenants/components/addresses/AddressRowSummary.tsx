import { Badge } from "@/components/ui/Badge";
import { formatPeriod, getPeriodStatusToday } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";
import type { AddressRowValues } from "./addressRow";

/**
 * Zusammenfassung einer abweichenden Anschrift in der Ansichts-Liste:
 * Adresse, Status-Badges, Zeitraum
 */
export const AddressRowSummary = ({
  row,
  index,
  tenantStartDate,
  tenantEndDate,
}: {
  row: AddressRowValues;
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
  const title =
    [row.street, [row.postalCode, row.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") || t("ui.tenant.addressIndex", { index: index + 1 });

  return (
    <>
      <div className="flex items-center gap-2">
        <p className="truncate font-semibold">{title}</p>
        {periodStatus === "active" ? (
          <Badge variant="ok">{t("ui.tenant.addressCurrent")}</Badge>
        ) : null}
        {periodStatus === "last" ? (
          <Badge variant="warn">{t("ui.tenant.lastAddress")}</Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {formatPeriod(effectiveStart, effectiveEnd)}
      </p>
    </>
  );
};
