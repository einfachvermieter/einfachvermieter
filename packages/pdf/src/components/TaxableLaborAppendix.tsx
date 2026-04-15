import { formatEur, type TaxableLaborCosts } from "@einfachvermieter/shared";
import { Text, View } from "@react-pdf/renderer";
import { t } from "../i18n.js";
import { styles } from "../styles.js";

type Props = {
  detail: TaxableLaborCosts;
};

const COL_POSITION = { flex: 3 };
const COL_AMOUNT = { flex: 1 };

const categoryTitle = (category: "craftsman" | "household_service"): string => {
  if (category === "craftsman") {
    return t("statements.pdf.taxableLabor.craftsman");
  }

  return t("statements.pdf.taxableLabor.householdService");
};

/**
 * Bescheinigung der auf den Mieter umgelegten Lohnkostenanteile nach
 * § 35a EStG. Pro Kategorie eine eigene Tabelle (Handwerker und
 * haushaltsnahe DL). Wird nur gerendert, wenn mindestens eine Kategorie
 * Beträge trägt.
 */
export const TaxableLaborAppendix = ({ detail }: Props) => {
  if (detail.byCategory.length === 0) {
    return null;
  }

  return (
    <View>
      <Text style={styles.paragraph}>
        {t("statements.pdf.taxableLabor.intro")}
      </Text>
      {detail.byCategory.map((group) => (
        <View key={group.category} wrap={false}>
          <Text style={styles.sectionHeading}>
            {categoryTitle(group.category)}
          </Text>
          <View style={styles.table}>
            <View style={styles.rowHeader}>
              <View style={[styles.cellLeft, COL_POSITION]}>
                <Text>{t("statements.pdf.taxableLabor.position")}</Text>
              </View>
              <View style={[styles.cellRight, styles.cellDivider, COL_AMOUNT]}>
                <Text>{t("statements.pdf.taxableLabor.tenantAmount")}</Text>
              </View>
            </View>
            {group.lines.map((line) => (
              <View
                key={line.costTypeId}
                style={[styles.row, styles.rowDivider]}
              >
                <View style={[styles.cellLeft, COL_POSITION]}>
                  <Text>{line.costTypeName}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, COL_AMOUNT]}
                >
                  <Text>{formatEur(line.tenantAmountCents)}</Text>
                </View>
              </View>
            ))}
            <View style={[styles.row, styles.rowDividerStrong]}>
              <View style={[styles.cellLeft, styles.bold, COL_POSITION]}>
                <Text>{t("statements.pdf.taxableLabor.subtotal")}</Text>
              </View>
              <View
                style={[
                  styles.cellRight,
                  styles.cellDivider,
                  styles.bold,
                  COL_AMOUNT,
                ]}
              >
                <Text>{formatEur(group.tenantTotalCents)}</Text>
              </View>
            </View>
          </View>
        </View>
      ))}
      <Text style={styles.footnote}>
        {t("statements.pdf.taxableLabor.disclaimer")}
      </Text>
    </View>
  );
};
