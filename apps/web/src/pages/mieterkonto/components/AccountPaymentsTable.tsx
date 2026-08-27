import { formatDate, formatEur } from "@einfachvermieter/shared";
import { RowActions } from "@/components/RowActions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { t } from "@/lib/i18n";
import {
  type Payment,
  paymentDisplayAmountCents,
  paymentPurposeLabel,
} from "@/lib/payments";
import type { useDeleteResource } from "@/lib/useDeleteResource";

type AccountPaymentsTableProps = {
  rows: Payment[];
  deletion: ReturnType<typeof useDeleteResource<Payment>>;
  onEditPayment: (payment: Payment) => void;
};

/**
 * Nicht-Monats-Buchungen (Abrechnung/Kaution/Gebühr) des Mieterkontos
 */
export const AccountPaymentsTable = ({
  rows,
  deletion,
  onEditPayment,
}: AccountPaymentsTableProps) => {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-muted-foreground">
        {t("ui.account.otherPaymentsEmpty")}
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-4" />
          <TableHead className="px-4">
            {t("ui.payments.columns.date")}
          </TableHead>
          <TableHead className="px-4">
            {t("ui.payments.columns.purpose")}
          </TableHead>
          <TableHead className="px-4 text-right">
            {t("ui.common.columns.amount")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell className="px-4 py-3">
              <RowActions
                isDeleting={payment.id === deletion.deletingId}
                onEdit={() => onEditPayment(payment)}
                onDelete={() => deletion.request(payment)}
              />
            </TableCell>
            <TableCell className="px-4 py-3 tabular-nums">
              {formatDate(payment.paymentDate)}
            </TableCell>
            <TableCell className="px-4 py-3">
              {paymentPurposeLabel(payment)}
            </TableCell>
            <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
              {formatEur(paymentDisplayAmountCents(payment))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
