import {
  computeStatus,
  formatEur,
  type MonthGridRow,
  type PotState,
} from "@einfachvermieter/shared";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
} from "@remixicon/react";
import { Fragment, useMemo, useState } from "react";
import { RowActionButton, RowActions } from "@/components/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { monthStatus } from "@/lib/accounts";
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
  <TableCell className="px-4 py-3 text-right align-middle tabular-nums">
    <span className="font-semibold">{formatEur(pot.istCents)}</span>{" "}
    <span className="text-muted-foreground">
      {`/ ${formatEur(pot.sollCents)}`}
    </span>
  </TableCell>
);

const MONTH_STATUS_VARIANT = {
  balanced: "ok",
  credit: "info",
  partial: "warn",
  open: "bad",
  upcoming: "neutral",
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
  const status = monthStatus(base, advance, forMonth);
  return (
    <TableCell className="px-4 py-3 align-middle">
      <Badge variant={MONTH_STATUS_VARIANT[status]}>
        {t(`ui.account.status.${status}`)}
      </Badge>
    </TableCell>
  );
};

type MonthGridTableProps = {
  monthRows: MonthGridRow[];
  payments: Payment[];
  deletion: ReturnType<typeof useDeleteResource<Payment>>;
  onRecordPayment: (row: MonthGridRow) => void;
  onEditPayment: (payment: Payment) => void;
};

/**
 * Monatsraster Kaltmiete/NK-Voraus: nach Jahr gruppiert (absteigend,
 * neuestes Jahr offen, frühere eingeklappt), je Monat Ist x Soll x Status
 * pro Topf plus Zahlungs-Aktionen.
 */
export const MonthGridTable = ({
  monthRows,
  payments,
  deletion,
  onRecordPayment,
  onEditPayment,
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

  // Ältere Jahre kappen, damit die Seitenhöhe bei langen Verträgen
  // konstant bleibt: neben dem aktuellen Jahr nur drei zurückliegende.
  const [showAllYears, setShowAllYears] = useState(false);
  const visibleGroups = showAllYears ? monthsByYear : monthsByYear.slice(0, 4);
  const hasHiddenYears = visibleGroups.length < monthsByYear.length;

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
          visibleGroups.map((group) => {
            const { year, rows } = group;
            const open = isYearOpen(year);
            return (
              <Fragment key={year}>
                <TableRow className="border-schiefer-200 border-t-2 bg-schiefer-100 hover:bg-schiefer-100">
                  <TableCell className="px-4 py-2 align-middle">
                    <Button
                      type="button"
                      variant="ghostMuted"
                      size="icon-sm"
                      aria-expanded={open}
                      aria-label={t("ui.account.toggleYear", { year })}
                      onClick={() => toggleYear(year)}
                    >
                      {open ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
                    </Button>
                  </TableCell>
                  <TableCell className="p-0 align-middle">
                    <button
                      type="button"
                      onClick={() => toggleYear(year)}
                      className="w-full px-4 py-2 text-left text-base font-semibold tabular-nums"
                    >
                      {year}
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
                        <TableCell className="px-4 py-3 align-middle">
                          {row.paymentIds.length === 0 ? (
                            <RowActionButton
                              label={t("ui.account.recordPayment")}
                              icon={<RiAddLine />}
                              onSelect={() => onRecordPayment(row)}
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
                                    onEdit={() => onEditPayment(payment)}
                                    onDelete={() => deletion.request(payment)}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 align-middle font-medium tabular-nums">
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
        {hasHiddenYears ? (
          <TableRow>
            <TableCell colSpan={5} className="px-4 py-2">
              <Button
                type="button"
                variant="addLink"
                size="text"
                onClick={() => setShowAllYears(true)}
              >
                {t("ui.account.showEarlierYears")}
              </Button>
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
};
