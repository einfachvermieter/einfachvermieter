import type { FeeRow } from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import { RiMoneyEuroCircleLine } from "@remixicon/react";
import { RowActionButton, RowActions } from "@/components/RowActions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { t } from "@/lib/i18n";
import type { useDeleteResource } from "@/lib/useDeleteResource";
import { PotCell } from "./PotCell";

export type FeeDeletionTarget = {
  id: string;
  date: string;
  amountCents: number;
};

type FeesTableProps = {
  rows: FeeRow[];
  deletion: ReturnType<typeof useDeleteResource<FeeDeletionTarget>>;
  onEditFee: (row: FeeRow) => void;
  onRecordPayment: (row: FeeRow) => void;
};

/**
 * Gebühren (Mahn-/Rücklauf-/Verzugsgebühren) des Mieterkontos
 */
export const FeesTable = ({
  rows,
  deletion,
  onEditFee,
  onRecordPayment,
}: FeesTableProps) => {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-muted-foreground">
        {t("ui.account.feesEmpty")}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-4" />
          <TableHead className="px-4">{t("ui.account.columns.date")}</TableHead>
          <TableHead className="px-4">
            {t("ui.account.columns.reason")}
          </TableHead>
          <TableHead className="px-4 text-right">
            {t("ui.account.columns.amount")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.feeId}>
            <TableCell className="px-4 py-3">
              <RowActions
                isDeleting={row.feeId === deletion.deletingId}
                onEdit={() => onEditFee(row)}
                extraActions={
                  <RowActionButton
                    label={t("ui.account.fee.recordPayment")}
                    icon={<RiMoneyEuroCircleLine />}
                    onSelect={() => onRecordPayment(row)}
                  />
                }
                onDelete={() =>
                  deletion.request({
                    id: row.feeId,
                    date: row.date,
                    amountCents: row.pot.sollCents,
                  })
                }
              />
            </TableCell>
            <TableCell className="px-4 py-3 tabular-nums">
              {formatDate(row.date)}
            </TableCell>
            <TableCell className="px-4 py-3">{row.reason}</TableCell>
            <TableCell className="px-4 py-3 text-right">
              <PotCell pot={row.pot} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
