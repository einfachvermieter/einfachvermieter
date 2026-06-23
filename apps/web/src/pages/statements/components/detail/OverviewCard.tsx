import type { StatementResult } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { Description } from "../../../../components/common/Description";
import { ResultRows } from "../../../../components/common/ResultRows";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/Card";
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
    <Card>
      <CardHeader>
        <CardTitle>{t("ui.statements.detail.overviewTitle")}</CardTitle>
        <Description>
          {t("ui.statements.detail.overviewDescription")}
        </Description>
      </CardHeader>
      <CardContent>
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
              value: t("ui.common.deductionAmount", {
                amount: formatEur(result.totalAdvancesCents),
              }),
            },
          ]}
        />
        <div
          className={cn(
            "mt-3.5 flex items-center justify-between rounded-[13px] px-4.25 py-3.25",
            isRefund
              ? "bg-teal-50 dark:bg-teal-950/30"
              : "bg-rose-50 dark:bg-rose-950/30",
          )}
        >
          <span
            className={cn(
              "text-sm font-semibold",
              isRefund
                ? "text-teal-600 dark:text-teal-400"
                : "text-rose-700 dark:text-rose-400",
            )}
          >
            {isRefund
              ? t("ui.statements.detail.refund")
              : t("ui.statements.detail.additionalPayment")}
          </span>
          <span
            className={cn(
              "text-[19px] font-semibold tabular-nums",
              isRefund
                ? "text-teal-600 dark:text-teal-400"
                : "text-rose-700 dark:text-rose-400",
            )}
          >
            {formatEur(Math.abs(result.balanceCents))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
