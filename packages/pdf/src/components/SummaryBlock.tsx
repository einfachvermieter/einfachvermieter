import { type CostLineResult, formatEur } from "@einfachvermieter/shared";
import { Text, View } from "@react-pdf/renderer";
import { t } from "../i18n.js";
import { styles } from "../styles.js";
import { Table } from "./Table.js";

type Props = {
  lines: CostLineResult[];
  totalAdvancesCents: number;
  balanceCents: number;
};

const COL_LABEL = { flex: 2.2 };
const COL_AMOUNT = { flex: 1.4 };

/**
 * Kurze Zusammenfassung auf Seite 1 der NK-Abrechnung, splittet die
 * umgelegten Kosten in Betriebs- und Heizkosten, zieht die Vorauszahlungen
 * ab und weist den Saldo (Nachzahlung oder Rückzahlung) prominent aus.
 */
export const SummaryBlock = ({
  lines,
  totalAdvancesCents,
  balanceCents,
}: Props) => {
  const heatingCents = lines
    .filter((l) => l.allocationKey === "heating_ordinance")
    .reduce((sum, l) => sum + l.tenantAmountCents, 0);
  const operatingCents = lines
    .filter((l) => l.allocationKey !== "heating_ordinance")
    .reduce((sum, l) => sum + l.tenantAmountCents, 0);
  const totalCents = operatingCents + heatingCents;

  const balanceLabel = (() => {
    if (balanceCents > 0) {
      return t("statements.pdf.balanceSettle");
    }
    if (balanceCents < 0) {
      return t("statements.pdf.balanceRefund");
    }
    return t("statements.pdf.balanceBalanced");
  })();

  type Row = {
    label: string;
    value: string;
    isTotal?: boolean;
  };

  const rows: Row[] = [
    {
      label: t("statements.pdf.summary.operatingCosts"),
      value: formatEur(operatingCents),
    },
    {
      label: t("statements.pdf.summary.heatingCosts"),
      value: formatEur(heatingCents),
    },
    {
      label: t("statements.pdf.summary.totalCosts"),
      value: formatEur(totalCents),
      isTotal: true,
    },
    {
      label: t("statements.pdf.summary.advances"),
      // Vorauszahlungen reduzieren die Forderung, negatives Vorzeichen,
      // damit die Summenzeile mathematisch eine echte Addition ist.
      value: formatEur(-totalAdvancesCents),
    },
    {
      label: balanceLabel,
      // Saldo mit korrektem Vorzeichen: positiv = Nachzahlung,
      // negativ = Rückzahlung. Bezeichnung weist zusätzlich textuell aus.
      value: formatEur(balanceCents),
      isTotal: true,
    },
  ];

  return (
    <Table plain={true}>
      {rows.map((row, idx) => {
        const hasDivider = row.isTotal && idx > 0;
        return (
          <View
            key={row.label}
            style={[
              styles.row,
              // Etwas Luft über der starken Trennlinie, damit die Lücke
              // optisch nicht durch die 1,5pt-Linie zusammengedrückt wirkt
              // gegenüber den linienlosen Zeilenabständen.
              ...(hasDivider
                ? [
                    styles.rowDividerStrong,
                    // marginTop = Luft über der Linie, paddingTop = Luft
                    // zwischen Linie und Zellinhalt; beides sorgt dafür,
                    // dass die Linie nicht klebt.
                    { marginTop: 3, paddingTop: 3 },
                  ]
                : []),
              ...(row.isTotal ? [styles.bold] : []),
            ]}
          >
            <View style={[styles.cellLeftPlain, COL_LABEL]}>
              <Text>{row.label}</Text>
            </View>
            <View style={[styles.cellRightPlain, COL_AMOUNT]}>
              <Text>{row.value}</Text>
            </View>
          </View>
        );
      })}
    </Table>
  );
};
