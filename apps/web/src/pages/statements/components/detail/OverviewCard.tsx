import { formatEur, type StatementResult } from "@einfachvermieter/shared";
import { TableFrame } from "@/components/common/TableFrame";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { IconCoins } from "@/lib/icons";
import { SectionCard } from "../../../../components/common/SectionCard";
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
      icon={IconCoins}
      title={t("ui.statements.detail.overviewCosts.title")}
      action={
        onShowDetails ? (
          <Button variant="addLink" size="text" onClick={onShowDetails}>
            {t("ui.statements.detail.overviewCosts.allDetails")}
          </Button>
        ) : undefined
      }
    >
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ui.statements.detail.columnCostType")}</TableHead>
              <TableHead>
                {t("ui.statements.detail.overviewCosts.columnDistribution")}
              </TableHead>
              <TableHead className="text-right">
                {t("ui.statements.detail.columnYourShare")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.lines.map((line) => (
              <TableRow key={line.costTypeName}>
                <TableCell className="font-semibold text-foreground">
                  {line.costTypeName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t(ALLOCATION_BY_LABEL_KEY[line.allocationKey])}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEur(line.tenantAmountCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold" colSpan={2}>
                {t("ui.statements.detail.sum")}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatEur(totalCents)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableFrame>
    </SectionCard>
  );
};
