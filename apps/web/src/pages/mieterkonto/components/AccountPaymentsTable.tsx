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
import { type Payment, paymentDisplayAmountCents } from "@/lib/payments";
import type { useDeleteResource } from "@/lib/useDeleteResource";

type AccountPaymentsTableProps = {
  rows: Payment[];
  deletion: ReturnType<typeof useDeleteResource<Payment>>;
  onEditPayment: (payment: Payment) => void;
};

/**
 * Einzelne Buchungen ohne eigene Forderungszeile: Kautionsbuchungen und
 * Zahlungen auf Abrechnungen, die nicht mehr finalisiert sind
 */
export const AccountPaymentsTable = ({
  rows,
  deletion,
  onEditPayment,
}: AccountPaymentsTableProps) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>{t("ui.payments.columns.date")}</TableHead>
        <TableHead>{t("ui.payments.columns.reference")}</TableHead>
        <TableHead className="text-right">
          {t("ui.common.columns.amount")}
        </TableHead>
        <TableHead className="w-22" />
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((payment) => (
        <TableRow key={payment.id}>
          <TableCell className="py-3 tabular-nums">
            {formatDate(payment.paymentDate)}
          </TableCell>
          <TableCell className="py-3 text-muted-foreground">
            {payment.reference}
          </TableCell>
          <TableCell className="py-3 text-right font-semibold tabular-nums">
            {formatEur(paymentDisplayAmountCents(payment))}
          </TableCell>
          <TableCell className="py-2">
            <div className="flex justify-end">
              <RowActions
                isDeleting={payment.id === deletion.deletingId}
                onEdit={() => onEditPayment(payment)}
                onDelete={() => deletion.request(payment)}
              />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
