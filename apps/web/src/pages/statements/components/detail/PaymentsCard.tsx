import {
  formatDate,
  formatEur,
  type Period,
  pad2,
  type StatementResult,
} from "@einfachvermieter/shared";
import { Description } from "../../../../components/common/Description";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/Card";
import { t } from "../../../../lib/i18n";

const PAYMENT_MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

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

// Spiegel von `aggregateByMonth` aus packages/pdf/.../PaymentsAppendix:
// pro Kalendermonat der Periode ein Bucket mit Summe NK-Voraus-Anteil.
const aggregatePaymentsByMonth = (
  payments: NonNullable<StatementResult["payments"]>,
  period: Period,
  tenantPeriod: Period,
): PaymentMonthBucket[] => {
  const tenantStartKey = tenantPeriod.start.slice(0, 7);
  const tenantEndKey = tenantPeriod.end.slice(0, 7);

  const buckets: PaymentMonthBucket[] = iterPeriodMonths(period).map(
    ({ year, month }) => {
      const monthKey = PAYMENT_MONTH_KEYS[month - 1];
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
    <Card>
      <CardHeader>
        <CardTitle>{t("ui.statements.detail.paymentsTitle")}</CardTitle>
        <Description>
          {t("ui.statements.detail.paymentsDescription")}
        </Description>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("ui.statements.detail.paymentsEmpty")}
          </p>
        ) : (
          <div className="space-y-6">
            {/* Monats-Matrix wie im PDF: NK-Voraus-Anteil je Kalendermonat. */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("statements.pdf.payments.intro")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border font-semibold text-muted-foreground">
                      {monthBuckets.map((b) => (
                        <th key={b.key} className="px-2 py-1.5 text-right">
                          {`${b.monthShort} ${b.year}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {monthBuckets.map((b) => (
                        <td
                          key={b.key}
                          className="px-2 py-1.5 text-right tabular-nums"
                        >
                          {b.inTenantPeriod
                            ? formatEur(b.advanceCents)
                            : t("ui.common.emptyValue")}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between border-t-2 border-foreground pt-1 text-sm font-semibold">
                <span>{t("statements.pdf.payments.total")}</span>
                <span className="tabular-nums">{formatEur(totalAdvance)}</span>
              </div>
            </div>

            {/* Detailtabelle (Vermietersicht), je Zahlung mit Datum,
                Verwendungszweck und Kaltmiete; im PDF aus Datenschutz-
                gründen nicht enthalten. */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="py-1.5">
                    {t("ui.statements.detail.paymentsColumnMonth")}
                  </th>
                  <th className="py-1.5">
                    {t("ui.statements.detail.paymentsColumnDate")}
                  </th>
                  <th className="py-1.5">
                    {t("ui.statements.detail.paymentsColumnReference")}
                  </th>
                  <th className="py-1.5 text-right">
                    {t("ui.statements.detail.paymentsColumnBaseRent")}
                  </th>
                  <th className="py-1.5 text-right">
                    {t("ui.statements.detail.paymentsColumnAdvance")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border">
                    <td className="py-1.5 tabular-nums">{payment.forMonth}</td>
                    <td className="py-1.5 tabular-nums">
                      {formatDate(payment.date)}
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground">
                      {payment.reference ?? t("common.none")}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatEur(payment.baseRentCents)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatEur(payment.advanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground">
                  <td className="py-2 font-semibold" colSpan={3}>
                    {t("ui.statements.detail.paymentsTotal", {
                      total: formatEur(total),
                    })}
                  </td>
                  <td className="py-2 text-right" colSpan={2}>
                    <span className="font-semibold tabular-nums">
                      {formatEur(totalAdvance)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
