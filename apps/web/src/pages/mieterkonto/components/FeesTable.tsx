import type { FeeRow } from "@einfachvermieter/shared";
import { RowActionButton, RowActions } from "@/components/RowActions";
import { t } from "@/lib/i18n";
import { IconPlus } from "@/lib/icons";
import type { Payment } from "@/lib/payments";
import type { useDeleteResource } from "@/lib/useDeleteResource";
import { ClaimTable } from "./ClaimTable";

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
  payments: Payment[];
  paymentDeletion: ReturnType<typeof useDeleteResource<Payment>>;
  onEditPayment: (payment: Payment) => void;
};

/**
 * Gebühren und Gutschriften des Mieterkontos, darunter die Zahlungen darauf
 */
export const FeesTable = ({
  rows,
  deletion,
  onEditFee,
  onRecordPayment,
  payments,
  paymentDeletion,
  onEditPayment,
}: FeesTableProps) => (
  <ClaimTable
    withReason={true}
    claims={rows.map((row) => ({
      id: row.feeId,
      date: row.date,
      reason: row.reason,
      pot: row.pot,
      paymentIds: row.paymentIds,
      actions: (
        <div className="flex justify-end">
          <RowActions
            isDeleting={row.feeId === deletion.deletingId}
            onEdit={() => onEditFee(row)}
            extraActions={
              <RowActionButton
                label={t("ui.account.fee.recordPayment")}
                icon={<IconPlus />}
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
        </div>
      ),
    }))}
    payments={payments}
    deletion={paymentDeletion}
    onEditPayment={onEditPayment}
  />
);
