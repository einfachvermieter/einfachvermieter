import {
  computeStatus,
  formatEur,
  type MonthGridRow,
  type PotState,
} from "@einfachvermieter/shared";
import { RiArrowRightSLine } from "@remixicon/react";
import { Fragment, useMemo, useState } from "react";
import { TableFrame } from "@/components/common/TableFrame";
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
import { IconChevronDown, IconPlus } from "@/lib/icons";
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
 * Eine Topf-Spalte: der eingegangene Betrag. Das Soll steht nur dabei, wenn
 * es abweicht ("150,00 € von 190,00 €")
 */
const PotIstSollCell = ({ pot }: { pot: PotState }) => (
  <TableCell className="px-3.5 py-3 text-right align-middle tabular-nums">
    <span className="font-semibold">{formatEur(pot.istCents)}</span>
    {pot.istCents === pot.sollCents ? null : (
      <span className="ml-1.5 text-muted-foreground">
        {t("ui.account.ofSoll", { amount: formatEur(pot.sollCents) })}
      </span>
    )}
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
  // Der Normalfall ist still: ausgeglichen braucht keinen Status
  return (
    <TableCell className="px-3.5 py-3 align-middle">
      {status === "balanced" ? null : (
        <Badge variant={MONTH_STATUS_VARIANT[status]}>
          {t(`ui.account.status.${status}`)}
        </Badge>
      )}
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
 * neuestes Jahr offen, frühere eingeklappt). Je Zelle ein Betrag, Soll und
 * Status nur bei Abweichung, rechts die Zahlungs-Aktionen.
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

  // Der Normalfall ist still: weicht nirgends etwas ab, entfällt die
  // Statusspalte ganz, statt leer dazustehen
  const showStatus = monthsByYear.some(
    (group) =>
      monthStatus(
        yearPot(group.baseSollCents, group.baseIstCents),
        yearPot(group.advanceSollCents, group.advanceIstCents),
      ) !== "balanced" ||
      group.rows.some(
        (row) =>
          monthStatus(row.baseRent, row.advance, row.forMonth) !== "balanced",
      ),
  );
  const columnCount = showStatus ? 6 : 5;

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

  const actionsOf = (row: MonthGridRow) =>
    row.paymentIds.length === 0 ? (
      <RowActionButton
        label={t("ui.account.recordPayment")}
        icon={<IconPlus />}
        onSelect={() => onRecordPayment(row)}
      />
    ) : (
      <div className="flex flex-col items-end gap-1">
        {row.paymentIds.map((paymentId) => {
          const payment = paymentById.get(paymentId);
          if (!payment) {
            return null;
          }
          return (
            <RowActions
              key={paymentId}
              isDeleting={paymentId === deletion.deletingId}
              onEdit={() => onEditPayment(payment)}
              onDelete={() => deletion.request(payment)}
            />
          );
        })}
      </div>
    );

  return (
    // Die Monate liegen wie ein schmalerer Zettel unter der Jahreszeile:
    // links ein Streifen in Azur 50, der nicht auf das Überfahren reagiert
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 px-0" />
            <TableHead className="pl-1">
              {t("ui.account.columns.yearMonth")}
            </TableHead>
            <TableHead className="text-right">
              {t("ui.account.columns.baseRent")}
            </TableHead>
            <TableHead className="text-right">
              {t("ui.account.columns.advance")}
            </TableHead>
            {showStatus ? (
              <TableHead>{t("ui.common.columns.status")}</TableHead>
            ) : null}
            <TableHead className="w-22" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {monthsByYear.length === 0 ? (
            <TableRow>
              <TableCell
                className="py-6 text-center text-muted-foreground"
                colSpan={columnCount}
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
                  <TableRow>
                    <TableCell className="py-2 pr-0 pl-2.5 align-middle">
                      <Button
                        type="button"
                        variant="ghostMuted"
                        size="icon-xs"
                        aria-expanded={open}
                        aria-label={t("ui.account.toggleYear", { year })}
                        onClick={() => toggleYear(year)}
                      >
                        {open ? <IconChevronDown /> : <RiArrowRightSLine />}
                      </Button>
                    </TableCell>
                    <TableCell className="p-0 align-middle">
                      <button
                        type="button"
                        onClick={() => toggleYear(year)}
                        className="w-full py-3 pl-1 text-left font-semibold tabular-nums"
                      >
                        {year}
                      </button>
                    </TableCell>
                    <PotIstSollCell
                      pot={yearPot(group.baseSollCents, group.baseIstCents)}
                    />
                    <PotIstSollCell
                      pot={yearPot(
                        group.advanceSollCents,
                        group.advanceIstCents,
                      )}
                    />
                    {showStatus ? (
                      <MonthStatusBadge
                        base={yearPot(group.baseSollCents, group.baseIstCents)}
                        advance={yearPot(
                          group.advanceSollCents,
                          group.advanceIstCents,
                        )}
                      />
                    ) : null}
                    <TableCell />
                  </TableRow>
                  {open
                    ? rows.map((row) => (
                        <TableRow key={row.forMonth}>
                          {/* Fläche statt linkem Rahmen: ein Rahmen ragt bei
                              border-collapse zur Hälfte über die Tabelle
                              hinaus und rückt Kopf- und Jahreszeilen ein */}
                          <TableCell className="relative p-0">
                            <span className="absolute inset-y-0 left-0 w-3 bg-azur-50" />
                          </TableCell>
                          <TableCell className="py-3 pl-1 align-middle tabular-nums">
                            {formatForMonth(row.forMonth)}
                          </TableCell>
                          <PotIstSollCell pot={row.baseRent} />
                          <PotIstSollCell pot={row.advance} />
                          {showStatus ? (
                            <MonthStatusBadge
                              base={row.baseRent}
                              advance={row.advance}
                              forMonth={row.forMonth}
                            />
                          ) : null}
                          <TableCell className="py-2 text-right align-middle">
                            {actionsOf(row)}
                          </TableCell>
                        </TableRow>
                      ))
                    : null}
                </Fragment>
              );
            })
          )}
          {hasHiddenYears ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-2 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setShowAllYears(true)}
                >
                  <IconChevronDown />
                  {t("ui.account.showEarlierYears")}
                </Button>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TableFrame>
  );
};
