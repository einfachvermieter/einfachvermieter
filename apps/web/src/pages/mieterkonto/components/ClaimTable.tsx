import { formatDate, formatEur, type PotState } from "@einfachvermieter/shared";
import { RiArrowRightSLine } from "@remixicon/react";
import { Fragment, type ReactNode, useState } from "react";
import { TableFrame } from "@/components/common/TableFrame";
import { RowActions } from "@/components/RowActions";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { t } from "@/lib/i18n";
import { IconChevronDown } from "@/lib/icons";
import { type Payment, paymentDisplayAmountCents } from "@/lib/payments";
import type { useDeleteResource } from "@/lib/useDeleteResource";
import { AccountStatusBadge } from "./AccountStatusBadge";

/**
 * Eine Forderung des Mieterkontos (Abrechnung, Gebühr) mit ihren Zahlungen
 */
export type Claim = {
  id: string;
  date: string;
  reason?: string;
  pot: PotState;
  paymentIds: string[];

  /**
   * Aktionen der Forderung selbst, etwa "Zahlung erfassen"
   */
  actions: ReactNode;
};

type ClaimTableProps = {
  claims: Claim[];

  /**
   * Spalte "Grund" für Forderungen mit eigener Begründung (Gebühren)
   */
  withReason?: boolean;
  payments: Payment[];
  deletion: ReturnType<typeof useDeleteResource<Payment>>;
  onEditPayment: (payment: Payment) => void;
};

/**
 * Forderungen mit Betrag, Bezahltem und Status. Die Zahlungen liegen
 * aufklappbar darunter, wie die Monate unter ihrem Jahr
 */
export const ClaimTable = ({
  claims,
  withReason = false,
  payments,
  deletion,
  onEditPayment,
}: ClaimTableProps) => {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));

  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 px-0" />
            <TableHead className="pl-1">
              {t("ui.account.columns.date")}
            </TableHead>
            {withReason ? (
              <TableHead>{t("ui.account.columns.reason")}</TableHead>
            ) : null}
            <TableHead className="text-right">
              {t("ui.account.columns.amount")}
            </TableHead>
            <TableHead className="text-right">
              {t("ui.account.columns.paid")}
            </TableHead>
            <TableHead>{t("ui.common.columns.status")}</TableHead>
            <TableHead className="w-22" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {claims.map((claim) => {
            const open = openIds.has(claim.id);
            const claimPayments = claim.paymentIds.flatMap(
              (paymentId) => paymentById.get(paymentId) ?? [],
            );
            return (
              <Fragment key={claim.id}>
                <TableRow>
                  <TableCell className="py-2 pr-0 pl-2.5 align-middle">
                    {claimPayments.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghostMuted"
                        size="icon-xs"
                        aria-expanded={open}
                        aria-label={t("ui.account.togglePayments")}
                        onClick={() => toggle(claim.id)}
                      >
                        {open ? <IconChevronDown /> : <RiArrowRightSLine />}
                      </Button>
                    ) : null}
                  </TableCell>
                  <TableCell className="py-3 pl-1 align-middle font-semibold tabular-nums">
                    {formatDate(claim.date)}
                  </TableCell>
                  {withReason ? (
                    <TableCell className="py-3 align-middle">
                      {claim.reason}
                    </TableCell>
                  ) : null}
                  <TableCell className="py-3 text-right align-middle font-semibold tabular-nums">
                    {formatEur(claim.pot.sollCents)}
                  </TableCell>
                  <TableCell className="py-3 text-right align-middle tabular-nums">
                    {formatEur(claim.pot.istCents)}
                  </TableCell>
                  <TableCell className="px-3.5 py-3 align-middle">
                    <AccountStatusBadge pot={claim.pot} />
                  </TableCell>
                  <TableCell className="py-2 text-right align-middle">
                    {claim.actions}
                  </TableCell>
                </TableRow>
                {open
                  ? claimPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="relative p-0">
                          <span className="absolute inset-y-0 left-0 w-3 bg-azur-50" />
                        </TableCell>
                        <TableCell className="py-3 pl-1 align-middle tabular-nums">
                          {formatDate(payment.paymentDate)}
                        </TableCell>
                        {withReason ? (
                          <TableCell className="py-3 align-middle text-muted-foreground">
                            {payment.reference}
                          </TableCell>
                        ) : null}
                        <TableCell />
                        <TableCell className="py-3 text-right align-middle tabular-nums">
                          {formatEur(paymentDisplayAmountCents(payment))}
                        </TableCell>
                        <TableCell />
                        <TableCell className="py-2 text-right align-middle">
                          <RowActions
                            isDeleting={payment.id === deletion.deletingId}
                            onEdit={() => onEditPayment(payment)}
                            onDelete={() => deletion.request(payment)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableFrame>
  );
};
