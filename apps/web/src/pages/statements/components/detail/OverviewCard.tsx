import type { StatementResult } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { Description } from "../../../../components/common/Description";
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ui.statements.detail.overviewTitle")}</CardTitle>
        <Description>
          {t("ui.statements.detail.overviewDescription")}
        </Description>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1">
                {t("ui.statements.detail.summaryOperatingCosts")}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatEur(operatingCents)}
              </td>
            </tr>
            <tr>
              <td className="py-1">
                {t("ui.statements.detail.summaryHeatingCosts")}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatEur(heatingCents)}
              </td>
            </tr>
            <tr className="border-t border-border font-semibold">
              <td className="py-1.5">{t("ui.statements.detail.totalCosts")}</td>
              <td className="py-1.5 text-right tabular-nums">
                {formatEur(totalCents)}
              </td>
            </tr>
            <tr>
              <td className="py-1">{t("ui.statements.detail.advances")}</td>
              <td className="py-1 text-right tabular-nums">
                {t("ui.common.deductionAmount", {
                  amount: formatEur(result.totalAdvancesCents),
                })}
              </td>
            </tr>
            <tr className="border-t-2 border-foreground text-base font-semibold">
              <td
                className={cn(
                  "py-2",
                  result.balanceCents > 0 ? "text-rose-700" : "text-teal-700",
                )}
              >
                {result.balanceCents > 0
                  ? t("ui.statements.detail.additionalPayment")
                  : t("ui.statements.detail.refund")}
              </td>
              <td
                className={cn(
                  "py-2 text-right tabular-nums",
                  result.balanceCents > 0 ? "text-rose-700" : "text-teal-700",
                )}
              >
                {formatEur(Math.abs(result.balanceCents))}
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
