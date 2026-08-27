import { formatEur, type StatementResult } from "@einfachvermieter/shared";
import { RiCoinsLine } from "@remixicon/react";
import { SectionCard } from "../../../../components/common/SectionCard";
import { QUIET_TABLE_HEAD_ROW } from "../../../../components/common/tableStyles";
import { Button } from "../../../../components/ui/Button";
import { t } from "../../../../lib/i18n";
import { ALLOCATION_BY_LABEL_KEY } from "../../../../lib/statements";

/**
 * Kosten-Kurzübersicht im Übersicht-Tab: eine Zeile je Kostenposition mit
 * Umlageschlüssel und Mieter-Anteil. Der Rechenweg steht in den Tabs
 * Betriebskosten und Heizkosten.
 */
export const OverviewCard = ({
  result,
  onShowDetails,
}: {
  result: StatementResult;
  /**
   * Wechselt in den Betriebskosten-Tab
   */
  onShowDetails?: () => void;
}) => {
  const totalCents = result.lines.reduce(
    (sum, line) => sum + line.tenantAmountCents,
    0,
  );
  return (
    <SectionCard
      icon={RiCoinsLine}
      title={t("ui.statements.detail.overviewCosts.title")}
      action={
        onShowDetails ? (
          <Button variant="addLink" size="text" onClick={onShowDetails}>
            {t("ui.statements.detail.overviewCosts.allDetails")}
          </Button>
        ) : undefined
      }
    >
      <div className="scroll-shadow-x overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={QUIET_TABLE_HEAD_ROW}>
              <th className="py-2.5">
                {t("ui.statements.detail.columnCostType")}
              </th>
              <th className="py-2.5">
                {t("ui.statements.detail.overviewCosts.columnDistribution")}
              </th>
              <th className="py-2.5 text-right">
                {t("ui.statements.detail.columnYourShare")}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((line) => (
              <tr key={line.costTypeName} className="border-b border-border">
                <td className="py-2.5 font-semibold text-foreground">
                  {line.costTypeName}
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {t(ALLOCATION_BY_LABEL_KEY[line.allocationKey])}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatEur(line.tenantAmountCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground">
              <td className="py-2 font-semibold" colSpan={2}>
                {t("ui.statements.detail.sum")}
              </td>
              <td className="py-2 text-right font-semibold tabular-nums">
                {formatEur(totalCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </SectionCard>
  );
};
