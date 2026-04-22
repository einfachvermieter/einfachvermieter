import type { FeeRow } from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import { RiMoneyEuroCircleLine, RiPencilLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
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
  tenantId: string;
  deletion: ReturnType<typeof useDeleteResource<FeeDeletionTarget>>;
};

/**
 * Gebühren (Mahn-/Rücklauf-/Verzugsgebühren) des Mieterkontos
 */
export const FeesTable = ({ rows, tenantId, deletion }: FeesTableProps) => {
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
                editLink={
                  <Link
                    to="/mieter/$tenantId/gebuehren/$feeId/bearbeiten"
                    params={{ tenantId, feeId: row.feeId }}
                  >
                    <RiPencilLine />
                  </Link>
                }
                extraActions={
                  <RowActionButton label={t("ui.account.fee.recordPayment")}>
                    <Link
                      to="/zahlungen/neu"
                      search={{
                        tenantId,
                        purposeKind: "fee",
                        forFeeId: row.feeId,
                      }}
                    >
                      <RiMoneyEuroCircleLine />
                    </Link>
                  </RowActionButton>
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
