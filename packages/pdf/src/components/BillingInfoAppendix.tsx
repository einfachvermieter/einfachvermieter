import {
  averageUserComparison,
  billingInfoCostRows,
  billingInfoRows,
  energyComparisonDisplay,
  type HeatingDetail,
  type Period,
} from "@einfachvermieter/shared";
import { Text, View } from "@react-pdf/renderer";
import { t } from "../i18n.js";
import { styles } from "../styles.js";
import { renderSuperscripts, toSuperscript } from "../superscript.js";
import { Table } from "./Table.js";

const INFO_COL_LABEL = { flex: 1 };
const INFO_COL_VALUE = { flex: 1 };

/**
 * Anhang "Abrechnungsinformationen nach § 6a HeizkostenV": Energieträger
 * (bei Fernwärme mit Treibhausgasemissionen und Primärenergiefaktor des
 * Netzes), enthaltene Steuern/Abgaben und Erfassungs-/Abrechnungsentgelte
 * (soweit erfasst), der Vergleich mit dem Durchschnittsnutzer,
 * Informations- und Beratungsstellen sowie der Hinweis zur
 * Streitbeilegung. Die beiden Textblöcke verlangt § 6a Abs. 5 auch
 * für nicht verbrauchsbasierte Abrechnungen.
 */
export const BillingInfoAppendix = ({
  detail,
  targetUnitId,
  tenantPeriod,
  statementPeriod,
}: {
  detail: HeatingDetail;
  targetUnitId: string;
  tenantPeriod: Period;
  statementPeriod: Period;
}) => {
  const rows = billingInfoRows(detail);
  const costRows = billingInfoCostRows(detail, t);
  const comparison = averageUserComparison(
    detail,
    targetUnitId,
    tenantPeriod,
    statementPeriod,
  );
  const prevComparison = detail.energyComparison
    ? energyComparisonDisplay(detail.energyComparison)
    : null;

  return (
    <View>
      {rows.length > 0 ? (
        <Table heading={t("statements.pdf.billingInfo.energyTitle")}>
          {rows.map((row, index) => (
            <View
              key={row.key}
              style={index === 0 ? styles.row : [styles.row, styles.rowDivider]}
            >
              <View style={[styles.cellLeftHeader, INFO_COL_LABEL]}>
                <Text>{t(row.label.key, row.label.params)}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, INFO_COL_VALUE]}
              >
                <Text>{t(row.value.key, row.value.params)}</Text>
              </View>
            </View>
          ))}
        </Table>
      ) : null}

      {rows.length === 0 ? (
        <Text style={styles.paragraph}>
          {t("statements.pdf.billingInfo.externalReference")}
        </Text>
      ) : null}

      {costRows.length > 0 ? (
        <Table heading={t("statements.pdf.billingInfo.costsTitle")}>
          {costRows.map((row, index) => (
            <View
              key={row.key}
              style={index === 0 ? styles.row : [styles.row, styles.rowDivider]}
            >
              <View style={[styles.cellLeftHeader, INFO_COL_LABEL]}>
                <Text>{t(row.label.key, row.label.params)}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, INFO_COL_VALUE]}
              >
                <Text>{t(row.value.key, row.value.params)}</Text>
              </View>
            </View>
          ))}
        </Table>
      ) : null}

      {comparison?.rows ? (
        <>
          <Table
            heading={renderSuperscripts(
              `${t("statements.pdf.billingInfo.comparisonTitle")}${toSuperscript(1)}`,
            )}
          >
            {comparison.rows.map((row, index) => (
              <View
                key={row.key}
                style={
                  index === 0 ? styles.row : [styles.row, styles.rowDivider]
                }
              >
                <View style={[styles.cellLeftHeader, INFO_COL_LABEL]}>
                  <Text>{t(row.label.key, row.label.params)}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, INFO_COL_VALUE]}
                >
                  <Text>{t(row.value.key, row.value.params)}</Text>
                </View>
              </View>
            ))}
          </Table>
          <Text style={styles.footnote}>
            {renderSuperscripts(
              `${toSuperscript(1)} ${t("statements.pdf.billingInfo.comparisonNote")}`,
            )}
          </Text>
          {comparison.isExtrapolated ? (
            <Text style={styles.footnote}>
              {t("statements.pdf.billingInfo.comparisonExtrapolatedNote")}
            </Text>
          ) : null}
        </>
      ) : null}

      {prevComparison ? (
        <>
          <Text style={styles.appendixSubheading}>
            {t("statements.pdf.billingInfo.comparisonPrevTitle")}
          </Text>
          {prevComparison.previousMissing ? (
            <Text style={styles.footnote}>
              {t("statements.pdf.billingInfo.comparisonPrevMissing")}
            </Text>
          ) : (
            <>
              {prevComparison.bars.map((bar) => (
                <View key={bar.key} style={styles.energyBarRow}>
                  <Text style={styles.energyBarLabel}>
                    {t(bar.label.key, bar.label.params)}
                  </Text>
                  <View style={styles.energyBarTrack}>
                    <View
                      style={[styles.energyBar, { width: `${bar.widthPct}%` }]}
                    />
                  </View>
                  <Text style={styles.energyBarValue}>
                    {t(bar.value.key, bar.value.params)}
                  </Text>
                </View>
              ))}
              {prevComparison.notes.map((note) => (
                <Text key={note.key} style={styles.footnote}>
                  {t(note.key, note.params)}
                </Text>
              ))}
            </>
          )}
        </>
      ) : null}

      <View style={styles.fineprint}>
        <Text style={styles.appendixSubheading}>
          {t("statements.pdf.billingInfo.contactsTitle")}
        </Text>
        <Text style={styles.paragraph}>
          {t("statements.pdf.billingInfo.contactsIntro")}
        </Text>
        <Text>{t("statements.pdf.billingInfo.contact1")}</Text>
        <Text>{t("statements.pdf.billingInfo.contact2")}</Text>
        <Text>{t("statements.pdf.billingInfo.contact3")}</Text>

        <Text style={styles.appendixSubheading}>
          {t("statements.pdf.billingInfo.disputeTitle")}
        </Text>
        <Text>{t("statements.pdf.billingInfo.disputeText")}</Text>
      </View>
    </View>
  );
};
