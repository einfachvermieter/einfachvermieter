import { formatEur, pickRentForDate, todayIso } from "@einfachvermieter/shared";
import { useQueries } from "@tanstack/react-query";
import { BalanceAmount } from "../../components/common/BalanceAmount";
import { MiniKpiRow } from "../../components/common/MiniKpiRow";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  monthStatus,
  tenantBalanceQueryOptions,
  tenantDepositQueryOptions,
  tenantMonthGridQueryOptions,
} from "../../lib/accounts";
import { t } from "../../lib/i18n";
import { tenantQueryOptions } from "../../lib/tenants";

const SKELETON_KEYS = ["balance", "deposit", "warmRent"];

/**
 * Gemeinsame Kennzahlen-Reihe beider Mieter-Tabs: Mietkonto-Saldo mit
 * offenen Monaten, Kaution (separat geführt) und aktuelle Warmmiete.
 */
export const TenantKpiRow = ({ tenantId }: { tenantId: string }) => {
  const today = todayIso();
  const [
    { data: balance },
    { data: deposit },
    { data: monthRows },
    { data: aggregate },
  ] = useQueries({
    queries: [
      tenantBalanceQueryOptions(tenantId),
      tenantDepositQueryOptions(tenantId),
      tenantMonthGridQueryOptions(tenantId, { from: "2000-01-01", to: today }),
      tenantQueryOptions(tenantId),
    ],
  });

  if (!balance || !deposit || !monthRows || !aggregate) {
    return (
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-22 rounded-lg" />
        ))}
      </div>
    );
  }

  const openMonthCount = monthRows.filter((row) => {
    const status = monthStatus(row.baseRent, row.advance, row.forMonth);
    return status === "open" || status === "partial";
  }).length;

  const depositOpenCents = deposit.pot.sollCents - deposit.pot.istCents;
  let depositHint: string;
  if (deposit.pot.sollCents === 0) {
    depositHint = t("ui.tenant.kpi.depositNoneHint");
  } else if (deposit.pot.istCents === 0) {
    depositHint = t("ui.tenant.kpi.depositUnpaidHint");
  } else if (depositOpenCents > 0) {
    depositHint = t("ui.account.depositOpen", {
      amount: formatEur(depositOpenCents),
    });
  } else {
    depositHint = t("ui.tenant.kpi.depositPaidHint");
  }

  const currentRent = pickRentForDate(aggregate.rents, today);

  return (
    <MiniKpiRow
      items={[
        {
          label: t("ui.tenant.kpi.balanceLabel"),
          value: <BalanceAmount receivableCents={-balance.balanceCents} />,
          hint:
            openMonthCount > 0
              ? t("ui.tenant.kpi.openMonthsHint", { count: openMonthCount })
              : undefined,
        },
        {
          label: t("ui.account.depositLabel"),
          value:
            deposit.pot.sollCents > 0
              ? formatEur(deposit.pot.sollCents)
              : t("ui.common.emptyValue"),
          hint: depositHint,
        },
        {
          label: t("ui.tenant.hero.warmRent"),
          value: currentRent
            ? formatEur(
                currentRent.monthlyBaseRentCents +
                  currentRent.monthlyAdvanceCents,
              )
            : t("ui.common.emptyValue"),
          hint: currentRent
            ? t("ui.tenant.kpi.warmRentHint", {
                base: formatEur(currentRent.monthlyBaseRentCents),
                advance: formatEur(currentRent.monthlyAdvanceCents),
              })
            : undefined,
        },
      ]}
    />
  );
};
