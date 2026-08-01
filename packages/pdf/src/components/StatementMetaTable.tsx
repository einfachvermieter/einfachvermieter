import {
  daysBetween,
  formatDate,
  formatNumber,
  type Period,
} from "@einfachvermieter/shared";
import { Text, View } from "@react-pdf/renderer";
import { t } from "../i18n.js";
import { styles } from "../styles.js";
import { renderSuperscripts } from "../superscript.js";
import { Table } from "./Table.js";

type Props = {
  /**
   * Externe Abrechnungs-Nr., im Draft mit `X`-Platzhaltern für noch
   * nicht vergebene Stellen, sonst die finalisierte Form.
   */
  statementReference: string;
  unitName: string;
  /**
   * Optionale Bezeichnung der Mieteinheit in Wohnanlagen (z. B. "3.07").
   */
  unitNumber: string | null;
  unitAreaSqm: number;
  buildingTotalAreaSqm: number;
  period: Period;
  /**
   * Tatsächlicher Mietzeitraum, bei Teilperiode kürzer als `period`.
   */
  tenantPeriod: Period;
};

const COL_LABEL = { flex: 1.2 };
const COL_VALUE = { flex: 1.8 };

const formatPeriod = (period: Period): string =>
  `${formatDate(period.start)} – ${formatDate(period.end)}`;

/**
 * Eckdaten-Tabelle auf Seite 1 des Anschreibens, kompakte umrahmte
 * Tabelle in der linken Hälfte neben dem `SummaryBlock`. Mietzeitraum wird
 * nur bei Teilperiode ausgewiesen (da sonst Abrechnungszeitraum).
 * Nutzungstage werden immer als Verhältnis `Mieter-Tage / Perioden-Tage`
 * gezeigt. Bei Vollperiode sind beide gleich (z. B. "365 / 365").
 */
export const StatementMetaTable = ({
  statementReference,
  unitName,
  unitNumber,
  unitAreaSqm,
  buildingTotalAreaSqm,
  period,
  tenantPeriod,
}: Props) => {
  const isPartialTenantPeriod =
    tenantPeriod.start !== period.start || tenantPeriod.end !== period.end;
  const unitLabel = unitNumber ? `${unitName} (${unitNumber})` : unitName;

  type Row = {
    key: string;
    label: string;
    value: string;
  };

  const rows: Row[] = [
    {
      key: "reference",
      label: t("statements.pdf.metaTable.reference"),
      value: statementReference,
    },
    {
      key: "unit",
      label: t("statements.pdf.metaTable.unit"),
      value: unitLabel,
    },
    {
      key: "unitArea",
      label: t("statements.pdf.metaTable.unitArea"),
      value: t("statements.pdf.metaTable.areaSqm", {
        value: `${formatNumber(unitAreaSqm, 2)} / ${formatNumber(buildingTotalAreaSqm, 2)}`,
      }),
    },
    {
      key: "period",
      label: t("statements.pdf.metaTable.period"),
      value: formatPeriod(period),
    },
  ];

  if (isPartialTenantPeriod) {
    rows.push({
      key: "tenantPeriod",
      label: t("statements.pdf.metaTable.tenantPeriod"),
      value: formatPeriod(tenantPeriod),
    });
  }

  rows.push({
    key: "tenantPeriodDays",
    label: t("statements.pdf.metaTable.tenantPeriodDays"),
    value: `${daysBetween(tenantPeriod.start, tenantPeriod.end)} / ${daysBetween(period.start, period.end)}`,
  });

  return (
    <Table>
      {rows.map((row, idx) => (
        <View
          key={row.key}
          style={[styles.row, ...(idx > 0 ? [styles.rowDivider] : [])]}
        >
          <View style={[styles.cellLeftHeader, COL_LABEL]}>
            <Text>{row.label}</Text>
          </View>
          <View style={[styles.cellLeft, styles.cellDivider, COL_VALUE]}>
            <Text>{renderSuperscripts(row.value)}</Text>
          </View>
        </View>
      ))}
    </Table>
  );
};
