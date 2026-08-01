import {
  formatEur,
  type PaymentSummary,
  type Period,
  pad2,
} from "@einfachvermieter/shared";
import { Text, View } from "@react-pdf/renderer";
import { t } from "../i18n.js";
import { styles } from "../styles.js";
import { Table } from "./Table.js";

type Props = {
  payments: PaymentSummary[];
  period: Period;
  /**
   * Tatsächlicher Mietzeitraum innerhalb der Abrechnungsperiode (z. B.
   * bei unterjährigem Ein-/Auszug). Monate außerhalb dieses Zeitraums
   * werden in der Tabelle mit "-" markiert, Monate innerhalb mit
   * "0,00 €", wenn keine Zahlung erfasst wurde.
   */
  tenantPeriod: Period;
};

type MonthBucket = {
  /**
   * "YYYY-MM" als sortierbarer Key.
   */
  key: string;
  monthLong: string;
  monthShort: string;
  year: string;
  advanceCents: number;
  inTenantPeriod: boolean;
};

const MONTH_KEYS = [
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

const SPLIT_THRESHOLD = 11;
const SHORT_NAME_THRESHOLD = 7;

const COL_MONTH = { flex: 1 };

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
 * Erzeugt pro Kalendermonat des Abrechnungszeitraums einen Bucket und
 * summiert die NK-Voraus-Anteile aller Zahlungen, die per `forMonth` auf
 * diesen Monat zeigen. Eine Zeile pro Monat kann mehrere Teilzahlungen
 * enthalten.
 */
const aggregateByMonth = (
  payments: PaymentSummary[],
  period: Period,
  tenantPeriod: Period,
): MonthBucket[] => {
  const months = iterPeriodMonths(period);
  const tenantStartKey = tenantPeriod.start.slice(0, 7);
  const tenantEndKey = tenantPeriod.end.slice(0, 7);

  const buckets: MonthBucket[] = months.map(({ year, month }) => {
    const monKey = MONTH_KEYS[month - 1];
    const key = `${year}-${pad2(month)}`;

    return {
      key,
      monthLong: t(`common.months.${monKey}`),
      monthShort: t(`common.monthsShort.${monKey}`),
      year: String(year),
      advanceCents: 0,
      inTenantPeriod: key >= tenantStartKey && key <= tenantEndKey,
    };
  });

  for (const payment of payments) {
    const bucket = buckets.find((b) => b.key === payment.forMonth);

    if (bucket) {
      bucket.advanceCents += payment.advanceCents;
    }
  }
  return buckets;
};

type MonthRowGroupProps = {
  buckets: MonthBucket[];
  useShortNames: boolean;
  padCount: number;
  withTopDivider: boolean;
};

const MonthRowGroup = ({
  buckets,
  useShortNames,
  padCount,
  withTopDivider,
}: MonthRowGroupProps) => {
  const pads = Array.from({ length: padCount });

  return (
    <>
      <View
        style={[
          styles.rowHeader,
          ...(withTopDivider ? [styles.rowDivider] : []),
        ]}
      >
        {buckets.map((b, idx) => (
          <View
            key={b.key}
            style={[
              styles.cellRight,
              ...(idx > 0 ? [styles.cellDivider] : []),
              COL_MONTH,
            ]}
          >
            <Text>
              {`${useShortNames ? b.monthShort : b.monthLong} ${b.year}`}
            </Text>
          </View>
        ))}
        {pads.map((_, idx) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: nur Padding, kein Inhalt
            key={`pad-h-${idx}`}
            style={[styles.cellRight, styles.cellDivider, COL_MONTH]}
          />
        ))}
      </View>
      <View style={[styles.row, styles.rowDivider]}>
        {buckets.map((b, idx) => (
          <View
            key={b.key}
            style={[
              styles.cellRight,
              ...(idx > 0 ? [styles.cellDivider] : []),
              COL_MONTH,
            ]}
          >
            <Text>
              {b.inTenantPeriod
                ? formatEur(b.advanceCents)
                : t("ui.common.emptyValue")}
            </Text>
          </View>
        ))}
        {pads.map((_, idx) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: nur Padding, kein Inhalt
            key={`pad-v-${idx}`}
            style={[styles.cellRight, styles.cellDivider, COL_MONTH]}
          />
        ))}
      </View>
    </>
  );
};

export const PaymentsAppendix = ({ payments, period, tenantPeriod }: Props) => {
  const buckets = aggregateByMonth(payments, period, tenantPeriod);
  const monthCount = buckets.length;
  const splitOnTwoRows = monthCount >= SPLIT_THRESHOLD;
  const firstRowCount = splitOnTwoRows ? Math.ceil(monthCount / 2) : monthCount;
  const useShortNames = firstRowCount >= SHORT_NAME_THRESHOLD;
  const firstRow = buckets.slice(0, firstRowCount);
  const secondRow = splitOnTwoRows ? buckets.slice(firstRowCount) : null;
  const secondRowPad = secondRow ? firstRowCount - secondRow.length : 0;
  const totalAdvanceCents = buckets.reduce((acc, b) => acc + b.advanceCents, 0);

  return (
    <View>
      {payments.length === 0 ? (
        <Text style={styles.paragraph}>
          {t("statements.pdf.payments.empty")}
        </Text>
      ) : (
        <>
          <Text style={styles.paragraph}>
            {t("statements.pdf.payments.intro")}
          </Text>
          <Table>
            <MonthRowGroup
              buckets={firstRow}
              useShortNames={useShortNames}
              padCount={0}
              withTopDivider={false}
            />
            {secondRow ? (
              <MonthRowGroup
                buckets={secondRow}
                useShortNames={useShortNames}
                padCount={secondRowPad}
                withTopDivider={true}
              />
            ) : null}
            <View style={[styles.row, styles.rowDividerStrong, styles.bold]}>
              <View style={[styles.cellLeft, { flex: firstRowCount - 1 }]}>
                <Text>{t("statements.pdf.payments.total")}</Text>
              </View>
              <View style={[styles.cellRight, COL_MONTH]}>
                <Text>{formatEur(totalAdvanceCents)}</Text>
              </View>
            </View>
          </Table>
        </>
      )}
    </View>
  );
};
