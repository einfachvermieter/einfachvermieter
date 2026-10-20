import { monthKeyOf } from "@einfachvermieter/i18n";
import {
  formatDate,
  formatEur,
  type Period,
  pad2,
  type StatementResult,
} from "@einfachvermieter/shared";
import { RiBankCardLine, RiListUnordered } from "@remixicon/react";
import { TableFrame } from "@/components/common/TableFrame";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { MonthTileGrid } from "../../../../components/common/MonthTileGrid";
import { SectionCard } from "../../../../components/common/SectionCard";
import { ComputedValueRow } from "../../../../components/form/ComputedValueRow";
import { t } from "../../../../lib/i18n";

type PaymentMonthBucket = {
  key: string;
  monthShort: string;
  year: string;
  /**
   * Summe NK-Voraus-Anteil aller Zahlungen, die diesen Monat treffen.
   */
  advanceCents: number;
  /**
   * True, wenn der Monat im Mietzeitraum lag.
   */
  inTenantPeriod: boolean;
};

const iterPeriodMonths = (
  period: Period,
): Array<{ year: number; month: number }> => {
  const startYear = Number(period.start.slice(0, 4));
  const startMonth = Number(period.start.slice(5, 7));
  const endYear = Number(period.end.slice(0, 4));
  const endMonth = Number(period.end.slice(5, 7));
  const result: Array<{ year: number; month: number }> = [];

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push({ year, month });
    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return result;
};

/**
 * Spiegel von `aggregateByMonth` aus packages/pdf/.../PaymentsAppendix:
 * pro Kalendermonat der Periode ein Bucket mit Summe NK-Voraus-Anteil.
 */
const aggregatePaymentsByMonth = (
  payments: NonNullable<StatementResult["payments"]>,
  period: Period,
  tenantPeriod: Period,
): PaymentMonthBucket[] => {
  const tenantStartKey = tenantPeriod.start.slice(0, 7);
  const tenantEndKey = tenantPeriod.end.slice(0, 7);

  const buckets: PaymentMonthBucket[] = iterPeriodMonths(period).map(
    ({ year, month }) => {
      const monthKey = monthKeyOf(month);
      const key = `${year}-${pad2(month)}`;

      return {
        key,
        monthShort: t(`common.monthsShort.${monthKey}`),
        year: String(year),
        advanceCents: 0,
        inTenantPeriod: key >= tenantStartKey && key <= tenantEndKey,
      };
    },
  );

  for (const payment of payments) {
    const bucket = buckets.find((b) => b.key === payment.forMonth);

    if (bucket) {
      bucket.advanceCents += payment.advanceCents;
    }
  }

  return buckets;
};

const tileState = (bucket: PaymentMonthBucket): "ok" | "open" | "outside" => {
  if (!bucket.inTenantPeriod) {
    return "outside";
  }
  return bucket.advanceCents > 0 ? "ok" : "open";
};

export const PaymentsCard = ({
  payments,
  period,
  tenantPeriod,
}: {
  payments: NonNullable<StatementResult["payments"]>;
  period: Period;
  tenantPeriod: Period;
}) => {
  const total = payments.reduce(
    (acc, p) => acc + p.baseRentCents + p.advanceCents,
    0,
  );

  const totalAdvance = payments.reduce((acc, p) => acc + p.advanceCents, 0);
  const monthBuckets = aggregatePaymentsByMonth(payments, period, tenantPeriod);

  return (
    <>
      <SectionCard
        icon={RiBankCardLine}
        title={t("ui.statements.detail.paymentsTitle")}
        description={t("ui.statements.detail.paymentsDescription")}
      >
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("ui.statements.detail.paymentsEmpty")}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Monats-Kacheln: NK-Voraus-Anteil je Kalendermonat (wie Aggregation der PDF-Anlage). Nicht den i18n aus dem PDF verwenden, da dort "Sie" Anrede! */}
            <p className="text-sm text-muted-foreground">
              {t("ui.statements.detail.paymentsIntro")}
            </p>
            <MonthTileGrid
              months={monthBuckets.map((b) => ({
                label: `${b.monthShort} ${b.year}`,
                value: b.inTenantPeriod
                  ? formatEur(b.advanceCents)
                  : t("ui.common.emptyValue"),
                state: tileState(b),
              }))}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden={true}
                  className="size-2 rounded-full bg-limette-400"
                />
                {t("ui.statements.detail.legendReceived")}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden={true}
                  className="size-2 rounded-full bg-honig-400"
                />
                {t("ui.statements.detail.legendOpen")}
              </span>
            </div>
            <ComputedValueRow
              label={t("ui.statements.detail.paymentsTotalAdvance")}
              value={formatEur(totalAdvance)}
            />
          </div>
        )}
      </SectionCard>

      {payments.length > 0 ? (
        <SectionCard
          collapsible={true}
          icon={RiListUnordered}
          title={t("ui.statements.detail.showEntries")}
        >
          {/* Detailtabelle (Vermietersicht), je Zahlung mit Datum,
              Verwendungszweck und Kaltmiete; im PDF aus Datenschutz-
              gründen nicht enthalten. */}
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("ui.statements.detail.paymentsColumnMonth")}
                  </TableHead>
                  <TableHead>
                    {t("ui.statements.detail.paymentsColumnDate")}
                  </TableHead>
                  <TableHead>
                    {t("ui.statements.detail.paymentsColumnReference")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("ui.statements.detail.paymentsColumnBaseRent")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("ui.statements.detail.paymentsColumnAdvance")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="tabular-nums">
                      {payment.forMonth}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(payment.date)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {payment.reference ?? t("common.none")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEur(payment.baseRentCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEur(payment.advanceCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold" colSpan={3}>
                    {t("ui.statements.detail.paymentsTotal", {
                      total: formatEur(total),
                    })}
                  </TableCell>
                  <TableCell className="text-right" colSpan={2}>
                    <span className="font-semibold tabular-nums">
                      {formatEur(totalAdvance)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableFrame>
        </SectionCard>
      ) : null}
    </>
  );
};
