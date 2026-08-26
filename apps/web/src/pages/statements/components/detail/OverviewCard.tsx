import type { StatementResult } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { RiScales3Line } from "@remixicon/react";
import { ResultRows } from "../../../../components/common/ResultRows";
import { SectionCard } from "../../../../components/common/SectionCard";
import { t } from "../../../../lib/i18n";
import { cn } from "../../../../lib/utils";

export const OverviewCard = ({ result }: { result: StatementResult }) => {
  const heatingCents = result.lines
    .filter((l) => l.allocationKey === "heating_ordinance")
    .reduce((sum, l) => sum + l.tenantAmountCents, 0);

  const operatingCents = result.lines
    .filter((l) => l.allocationKey !== "heating_ordinance")
    .reduce((sum, l) => sum + l.tenantAmountCents, 0);

  const totalCents = operatingCents + heatingCents;
  const isRefund = result.balanceCents <= 0;

  return (
    <SectionCard
      icon={RiScales3Line}
      title={t("ui.statements.detail.overviewTitle")}
      description={t("ui.statements.detail.overviewDescription")}
    >
      <ResultRows
        rows={[
          {
            label: t("ui.statements.detail.summaryOperatingCosts"),
            value: formatEur(operatingCents),
          },
          {
            label: t("ui.statements.detail.summaryHeatingCosts"),
            value: formatEur(heatingCents),
          },
          {
            label: t("ui.statements.detail.totalCosts"),
            value: formatEur(totalCents),
            kind: "sum",
          },
          {
            label: t("ui.statements.detail.advances"),
            // Ohne Vorauszahlungen gibt es nichts abzuziehen, das
            // Minuszeichen entfällt dann.
            value:
              result.totalAdvancesCents === 0
                ? formatEur(0)
                : t("ui.common.deductionAmount", {
                    amount: formatEur(result.totalAdvancesCents),
                  }),
          },
        ]}
      />
      <div
        className={cn(
          "mt-3.5 flex items-center justify-between rounded-lg px-4.25 py-3.25",
          isRefund ? "bg-limette-50" : "bg-himbeere-50",
        )}
      >
        <span
          className={cn(
            "text-sm font-semibold",
            isRefund ? "text-limette-700" : "text-himbeere-500",
          )}
        >
          {isRefund
            ? t("ui.statements.detail.refund")
            : t("ui.statements.detail.additionalPayment")}
        </span>
        <span
          className={cn(
            "text-lg font-semibold tabular-nums",
            isRefund ? "text-limette-700" : "text-himbeere-500",
          )}
        >
          {formatEur(Math.abs(result.balanceCents))}
        </span>
      </div>
    </SectionCard>
  );
};
