import type { SettlementRow } from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { t } from "@/lib/i18n";
import { PotCell } from "./PotCell";

/**
 * Abrechnungs-Solls (Settlements) des Mieterkontos
 */
export const SettlementsTable = ({ rows }: { rows: SettlementRow[] }) => {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-muted-foreground">
        {t("ui.account.settlementsEmpty")}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-4">{t("ui.account.columns.date")}</TableHead>
          <TableHead className="px-4 text-right">
            {t("ui.account.columns.amount")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.statementId}>
            <TableCell className="px-4 py-3 tabular-nums">
              {formatDate(row.date)}
            </TableCell>
            <TableCell className="px-4 py-3 text-right">
              <PotCell pot={row.pot} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
