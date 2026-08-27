import { formatIban } from "@einfachvermieter/shared";
import { Badge } from "@/components/ui/Badge";
import { formatPeriod, getPeriodStatusToday } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";
import type { BankAccountRowValues } from "./bankAccountRow";

/**
 * Zusammenfassung einer Bankverbindung in der Ansichts-Liste: IBAN,
 * Status- und Mandats-Badges, Kontoinhaber und Zeitraum
 */
export const BankAccountRowSummary = ({
  row,
  index,
  tenantStartDate,
  tenantEndDate,
}: {
  row: BankAccountRowValues;
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

  const title = row.iban
    ? formatIban(row.iban)
    : t("ui.tenant.bankAccountIndex", { index: index + 1 });

  const periodText = formatPeriod(row.startDate, row.endDate);

  return (
    <>
      <div className="flex items-center gap-2">
        <p className="truncate text-sm font-semibold tabular-nums">{title}</p>
        {periodStatus === "active" ? (
          <Badge variant="ok">{t("ui.tenant.bankAccountCurrent")}</Badge>
        ) : null}
        {periodStatus === "last" ? (
          <Badge variant="warn">{t("ui.tenant.lastBankAccount")}</Badge>
        ) : null}
        {row.mandateReference ? (
          <Badge variant="info">{t("ui.tenant.mandateBadge")}</Badge>
        ) : null}
      </div>
      {row.accountHolder || periodText ? (
        <p className="truncate text-sm">
          {row.accountHolder}
          {row.accountHolder && periodText
            ? t("ui.common.separators.bullet")
            : null}
          {periodText ? (
            <span className="text-muted-foreground tabular-nums">
              {periodText}
            </span>
          ) : null}
        </p>
      ) : null}
    </>
  );
};
