import {
  formatDate,
  formatEur,
  type Period,
  pad2,
  type StatementResult,
} from "@einfachvermieter/shared";
import { RiBankCardLine } from "@remixicon/react";
import { Disclose } from "../../../../components/common/Disclose";
import { MonthTileGrid } from "../../../../components/common/MonthTileGrid";
import { SectionCard } from "../../../../components/common/SectionCard";
import { QUIET_TABLE_HEAD_ROW } from "../../../../components/common/tableStyles";
import { ComputedValueRow } from "../../../../components/form/ComputedValueRow";
import { gradients } from "../../../../lib/domainVisuals";
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
    <SectionCard
      icon={RiBankCardLine}
      iconBackground={gradients.money}
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
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden={true}
                className="size-2 rounded-full bg-teal-400"
              />
              {t("ui.statements.detail.legendReceived")}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden={true}
                className="size-2 rounded-full bg-amber-400"
              />
              {t("ui.statements.detail.legendOpen")}
            </span>
          </div>
          <ComputedValueRow
            label={t("ui.statements.detail.paymentsTotalAdvance")}
            value={formatEur(totalAdvance)}
          />

          {/* Detailtabelle (Vermietersicht), je Zahlung mit Datum,
                Verwendungszweck und Kaltmiete; im PDF aus Datenschutz-
                gründen nicht enthalten. */}
          <Disclose label={t("ui.statements.detail.showEntries")}>
            <table className="w-full text-sm">
              <thead>
                <tr className={QUIET_TABLE_HEAD_ROW}>
                  <th className="py-2.5">
                    {t("ui.statements.detail.paymentsColumnMonth")}
                  </th>
                  <th className="py-2.5">
                    {t("ui.statements.detail.paymentsColumnDate")}
                  </th>
                  <th className="py-2.5">
                    {t("ui.statements.detail.paymentsColumnReference")}
                  </th>
                  <th className="py-2.5 text-right">
                    {t("ui.statements.detail.paymentsColumnBaseRent")}
                  </th>
                  <th className="py-2.5 text-right">
                    {t("ui.statements.detail.paymentsColumnAdvance")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border">
                    <td className="py-2.5 tabular-nums">{payment.forMonth}</td>
                    <td className="py-2.5 tabular-nums">
                      {formatDate(payment.date)}
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {payment.reference ?? t("common.none")}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatEur(payment.baseRentCents)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
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
          </Disclose>
        </div>
      )}
    </SectionCard>
  );
};
