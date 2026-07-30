import {
  computeStatus,
  formatEur,
  type MonthGridRow,
  type PotState,
  todayIso,
} from "@einfachvermieter/shared";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiPencilLine,
} from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { RowActionButton, RowActions } from "@/components/RowActions";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatForMonth } from "@/lib/dateInput";
import { t } from "@/lib/i18n";
import type { Payment } from "@/lib/payments";
import type { useDeleteResource } from "@/lib/useDeleteResource";

/**
 * Jahres-Summe je Kategorie: netto über alle Monate addiert (eine Überzahlung
 * im einen Monat darf einen Rückstand im anderen ausgleichen).
 */
const yearPot = (sollCents: number, istCents: number): PotState => ({
  sollCents,
  istCents,
  status: computeStatus(sollCents, istCents),
});

/**
 * Eine Topf-Spalte als eine Zelle "ist / soll"
 */
const PotIstSollCell = ({ pot }: { pot: PotState }) => (
  <TableCell className="px-4 py-3 text-right align-top tabular-nums">
    <span className="font-semibold">{formatEur(pot.istCents)}</span>{" "}
    <span className="text-muted-foreground">
      {`/ ${formatEur(pot.sollCents)}`}
    </span>
  </TableCell>
);

type MonthStatus = "balanced" | "credit" | "partial" | "open" | "upcoming";

/**
 * Kombinierter Monatsstatus aus beiden Töpfen (Kaltmiete + NK-Voraus):
 * alle ausgeglichen -> ausgeglichen; ein offener Posten -> teilweise offen
 */
const monthStatus = (base: PotState, advance: PotState): MonthStatus => {
  const pots = [base, advance];
  if (pots.every((pot) => pot.status === "balanced")) {
    return "balanced";
  }
  if (pots.some((pot) => pot.status === "open")) {
    return base.istCents !== 0 || advance.istCents !== 0 ? "partial" : "open";
  }
  return "credit";
};

const MONTH_STATUS_VARIANT = {
  balanced: "lightGreen",
  credit: "lightBlue",
  partial: "lightYellow",
  open: "lightRed",
  upcoming: "slate",
} as const;

const MonthStatusBadge = ({
  base,
  advance,
  forMonth,
}: {
  base: PotState;
  advance: PotState;
  /**
   * Monat der Zeile; ein noch nicht fälliger (aktueller/künftiger) Monat wird
   * neutral als "noch nicht fällig" ausgewiesen.
   * Für die Jahres-Summenzeile weggelassen.
   */
  forMonth?: string;
}) => {
  const computed = monthStatus(base, advance);
  const isUpcoming =
    forMonth !== undefined && forMonth >= todayIso().slice(0, 7);
  const status = isUpcoming && computed === "open" ? "upcoming" : computed;
  return (
    <TableCell className="px-4 py-3 align-top">
      <Badge variant={MONTH_STATUS_VARIANT[status]}>
        {t(`ui.account.status.${status}`)}
      </Badge>
    </TableCell>
  );
};

/**
 * Aktion für einen Monat ohne Zahlung: Inline-Erfassung öffnen
 * (`onRecordPayment`) oder als Fallback `/zahlungen/neu`.
 */
const RecordPaymentCell = ({
  row,
  tenantId,
  onRecordPayment,
}: {
  row: MonthGridRow;
  tenantId: string;
  onRecordPayment?: (row: MonthGridRow) => void;
}) =>
  onRecordPayment ? (
    <RowActionButton
      label={t("ui.account.recordPayment")}
      icon={<RiAddLine />}
      onSelect={() => onRecordPayment(row)}
    />
  ) : (
    <RowActionButton label={t("ui.account.recordPayment")}>
      <Link
        to="/zahlungen/neu"
        search={{
          tenantId,
          forMonth: row.forMonth,
          baseRentCents: row.baseRent.sollCents,
          advanceCents: row.advance.sollCents,
        }}
      >
        <RiAddLine />
      </Link>
    </RowActionButton>
  );

type MonthGridTableProps = {
  monthRows: MonthGridRow[];
  payments: Payment[];
  tenantId: string;
  deletion: ReturnType<typeof useDeleteResource<Payment>>;
  /**
   * Monats-"+" öffnet die eingebettete Inline-Erfassung (vorbelegt)
   * statt der Route `/zahlungen/neu`.
   */
  onRecordPayment?: (row: MonthGridRow) => void;
};

/**
 * Monatsraster Kaltmiete/NK-Voraus: nach Jahr gruppiert (absteigend,
 * neuestes Jahr offen, frühere eingeklappt), je Monat Ist x Soll x Status
 * pro Topf plus Zahlungs-Aktionen.
 */
export const MonthGridTable = ({
  monthRows,
  payments,
  tenantId,
  deletion,
  onRecordPayment,
}: MonthGridTableProps) => {
  const monthsByYear = useMemo(() => {
    const sorted = [...monthRows].reverse();
    const groups = new Map<string, MonthGridRow[]>();
    for (const row of sorted) {
      const year = row.forMonth.slice(0, 4);
      const list = groups.get(year) ?? [];
      list.push(row);
      groups.set(year, list);
    }
    return [...groups.entries()].map(([year, rows]) => {
      let baseSollCents = 0;
      let baseIstCents = 0;
      let advanceSollCents = 0;
      let advanceIstCents = 0;
      for (const row of rows) {
        baseSollCents += row.baseRent.sollCents;
        baseIstCents += row.baseRent.istCents;
        advanceSollCents += row.advance.sollCents;
        advanceIstCents += row.advance.istCents;
      }
      return {
        year,
        rows,
        baseSollCents,
        baseIstCents,
        advanceSollCents,
        advanceIstCents,
      };
    });
  }, [monthRows]);

  const latestYear = monthsByYear[0]?.year;
  // Standard: aktuelles (neuestes) Jahr offen, frühere zugeklappt.
  const [yearOverrides, setYearOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const isYearOpen = (year: string) =>
    yearOverrides[year] ?? year === latestYear;
  const toggleYear = (year: string) =>
    setYearOverrides((prev) => ({
      ...prev,
      [year]: !(prev[year] ?? year === latestYear),
    }));

  const paymentById = useMemo(() => {
    const map = new Map<string, Payment>();
    for (const payment of payments) {
      map.set(payment.id, payment);
    }
    return map;
  }, [payments]);

  return (
    <Table>
      <TableHeader>
        <TableRow className="text-muted-foreground">
          <TableHead className="px-4" />
          <TableHead className="px-4">
            {t("ui.account.columns.month")}
          </TableHead>
          <TableHead className="px-4 text-right">
            {t("ui.account.columns.baseRent")}
          </TableHead>
          <TableHead className="px-4 text-right">
            {t("ui.account.columns.advance")}
          </TableHead>
          <TableHead className="px-4">
            {t("ui.common.columns.status")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {monthsByYear.length === 0 ? (
          <TableRow>
            <TableCell
              className="px-4 py-6 text-center text-muted-foreground"
              colSpan={5}
            >
              {t("ui.account.monthsEmpty")}
            </TableCell>
          </TableRow>
        ) : (
          monthsByYear.map((group) => {
            const { year, rows } = group;
            const open = isYearOpen(year);
            return (
              <Fragment key={year}>
                <TableRow className="bg-muted/40">
                  <TableCell />
                  <TableCell className="p-0 align-middle">
                    <button
                      type="button"
                      onClick={() => toggleYear(year)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left font-semibold hover:bg-muted"
                    >
                      {open ? (
                        <RiArrowDownSLine className="size-4" />
                      ) : (
                        <RiArrowRightSLine className="size-4" />
                      )}
                      <span className="tabular-nums">{year}</span>
                    </button>
                  </TableCell>
                  <PotIstSollCell
                    pot={yearPot(group.baseSollCents, group.baseIstCents)}
                  />
                  <PotIstSollCell
                    pot={yearPot(group.advanceSollCents, group.advanceIstCents)}
                  />
                  <MonthStatusBadge
                    base={yearPot(group.baseSollCents, group.baseIstCents)}
                    advance={yearPot(
                      group.advanceSollCents,
                      group.advanceIstCents,
                    )}
                  />
                </TableRow>
                {open
                  ? rows.map((row) => (
                      <TableRow key={row.forMonth}>
                        <TableCell className="px-4 py-3">
                          {row.paymentIds.length === 0 ? (
                            <RecordPaymentCell
                              row={row}
                              tenantId={tenantId}
                              onRecordPayment={onRecordPayment}
                            />
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              {row.paymentIds.map((paymentId) => {
                                const payment = paymentById.get(paymentId);
                                if (!payment) {
                                  return null;
                                }
                                return (
                                  <RowActions
                                    key={paymentId}
                                    isDeleting={
                                      paymentId === deletion.deletingId
                                    }
                                    editLink={
                                      <Link
                                        to="/zahlungen/$paymentId/bearbeiten"
                                        params={{ paymentId }}
                                        search={{ tenantId }}
                                      >
                                        <RiPencilLine />
                                      </Link>
                                    }
                                    onDelete={() => deletion.request(payment)}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top font-medium tabular-nums">
                          {formatForMonth(row.forMonth)}
                        </TableCell>
                        <PotIstSollCell pot={row.baseRent} />
                        <PotIstSollCell pot={row.advance} />
                        <MonthStatusBadge
                          base={row.baseRent}
                          advance={row.advance}
                          forMonth={row.forMonth}
                        />
                      </TableRow>
                    ))
                  : null}
              </Fragment>
            );
          })
        )}
      </TableBody>
    </Table>
  );
};
