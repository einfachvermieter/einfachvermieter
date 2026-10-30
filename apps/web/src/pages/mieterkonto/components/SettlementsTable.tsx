import type { SettlementRow } from "@einfachvermieter/shared";
import { RowActionButton } from "@/components/RowActions";
import { t } from "@/lib/i18n";
import { IconPlus } from "@/lib/icons";
import type { Payment } from "@/lib/payments";
import type { useDeleteResource } from "@/lib/useDeleteResource";
import { ClaimTable } from "./ClaimTable";

type SettlementsTableProps = {
  rows: SettlementRow[];
  payments: Payment[];
  deletion: ReturnType<typeof useDeleteResource<Payment>>;
  onEditPayment: (payment: Payment) => void;
  onRecordPayment: (row: SettlementRow) => void;
};

/**
 * Nachzahlungen und Guthaben aus finalisierten Nebenkostenabrechnungen,
 * darunter die Zahlungen darauf
 */
export const SettlementsTable = ({
  rows,
  payments,
  deletion,
  onEditPayment,
  onRecordPayment,
}: SettlementsTableProps) => (
  <ClaimTable
    claims={rows.map((row) => ({
      id: row.statementId,
      date: row.date,
      pot: row.pot,
      paymentIds: row.paymentIds,
      actions: (
        <div className="flex justify-end">
          <RowActionButton
            label={t("ui.account.recordPayment")}
            icon={<IconPlus />}
            onSelect={() => onRecordPayment(row)}
          />
        </div>
      ),
    }))}
    payments={payments}
    deletion={deletion}
    onEditPayment={onEditPayment}
  />
);
