import { billingInfoRows, type HeatingDetail } from "@einfachvermieter/shared";
import { Text, View } from "@react-pdf/renderer";
import { t } from "../i18n.js";
import { styles } from "../styles.js";
import { Table } from "./Table.js";

const INFO_COL_LABEL = { flex: 1 };
const INFO_COL_VALUE = { flex: 1 };

/**
 * Anhang „Abrechnungsinformationen nach § 6a HeizkostenV": Energieträger
 * (bei Fernwärme mit Treibhausgasemissionen und Primärenergiefaktor des
 * Netzes), Informations- und Beratungsstellen sowie der Hinweis zur
 * Streitbeilegung. Die beiden Textblöcke verlangt § 6a Abs. 5 auch für
 * nicht verbrauchsbasierte Abrechnungen.
 */
export const BillingInfoAppendix = ({ detail }: { detail: HeatingDetail }) => {
  const rows = billingInfoRows(detail);

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
  );
};
