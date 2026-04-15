import {
  type CostLineResult,
  formatEur,
  formatNumber,
} from "@einfachvermieter/shared";
import { Text, View } from "@react-pdf/renderer";
import { t } from "../i18n.js";
import { styles } from "../styles.js";
import { renderSuperscripts, toSuperscript } from "../superscript.js";

type Props = {
  lines: CostLineResult[];
  totalCostsCents: number;
  /**
   * Optionaler Erläuterungstext für die Verbrauchs-Position (Frischwasser),
   * z. B. die Differenz-Berechnungsformel. Fußnote wird nur ausgewiesen,
   * wenn auch eine passende Zeile (per_consumption_m3, kein Schmutzwasser)
   * vorkommt.
   */
  consumptionNote?: string;
  /**
   * Optionaler Erläuterungstext für die Schmutzwasser-Position, z. B. der
   * Hinweis, dass der Schmutzwasserverbrauch dem Frischwasserverbrauch
   * entspricht.
   */
  wasteWaterNote?: string;
};

const COL_LABEL = { flex: 2 };
const COL_TOTAL_COSTS = { flex: 1 };
const COL_BEMESSUNG = { flex: 1.5 };
const COL_TAGE = { flex: 1 };
const COL_AMOUNT = { flex: 1 };
// Summe aller Spalten links vom Betrag (2 + 1 + 1.5 + 1 = 5.5).
const COL_TOTAL_LABEL = { flex: 5.5 };

const isWasteWaterName = (name: string): boolean =>
  /schmutzwasser|abwasser/iu.test(name);

// Definition einer Fußnote: eine Hochstellziffer auf Zeilen-Ebene plus der
// Erläuterungstext. Marker werden dynamisch in der Reihenfolge des
// ersten Auftretens in der Tabelle vergeben (1, 2, 3, ...).
type FootnoteDef = {
  applies: (line: CostLineResult) => boolean;
  text: string;
};

type NumberedFootnote = FootnoteDef & {
  marker: string;
};

const numberFootnotes = (
  lines: CostLineResult[],
  defs: FootnoteDef[],
): NumberedFootnote[] => {
  const seen = new Set<FootnoteDef>();
  const ordered: FootnoteDef[] = [];
  for (const line of lines) {
    for (const def of defs) {
      if (!seen.has(def) && def.applies(line)) {
        seen.add(def);
        ordered.push(def);
      }
    }
  }
  return ordered.map((def, idx) => ({
    ...def,
    marker: toSuperscript(idx + 1),
  }));
};

const allocationLabelKey: Record<CostLineResult["allocationKey"], string> = {
  // biome-ignore-start lint/style/useNamingConvention: domain bedingte keys
  per_living_area: "costs.allocationsBy.perLivingArea",
  per_heating_area: "costs.allocationsBy.perHeatingArea",
  per_person: "costs.allocationsBy.perPerson",
  per_unit: "costs.allocationsBy.perUnit",
  per_consumption_m3: "costs.allocationsBy.perConsumptionM3",
  per_consumption_kwh: "costs.allocationsBy.perConsumptionKwh",
  heating_ordinance: "costs.allocationsBy.heizkostenV",
  // biome-ignore-end lint/style/useNamingConvention: domain bedingte keys
  fixed: "costs.allocationsBy.fixed",
};

// Anzeigegenauigkeit pro Bemessungs-Einheit:
// - m2 (Wohnfläche/Heizfläche), m3 (Wasser): 2 Nachkommastellen
// - Personen, Wohnungen, Personentage: ganze Zahlen
const digitsForUnit = (unit: string | null | undefined): number =>
  unit === "m²" || unit === "m³" ? 2 : 0;

const PLURAL_UNIT_KEYS = new Set(["person"]);

// "Personentage" ist in der schmalen Spalte zu lang, "PT" plus Fußnote.
const displayUnit = (unit: string): string =>
  unit === "Personentage" ? "PT" : unit;

const fmtBemessung = (
  value: number,
  unit: string | null | undefined,
): string => {
  const digits = digitsForUnit(unit);
  if (!unit) {
    return formatNumber(value, digits);
  }
  const unitText = PLURAL_UNIT_KEYS.has(unit)
    ? t(`costs.units.${unit}`, { count: value })
    : displayUnit(unit);
  return `${formatNumber(value, digits)} ${unitText}`;
};

export const CostsTable = ({
  lines,
  totalCostsCents,
  consumptionNote,
  wasteWaterNote,
}: Props) => {
  // Nur tatsächlich anwendbare Fußnoten landen unter der Tabelle, in
  // der Reihenfolge ihres ersten Auftretens.
  const footnoteDefs: FootnoteDef[] = [];
  if (consumptionNote) {
    footnoteDefs.push({
      applies: (line) =>
        line.allocationKey === "per_consumption_m3" &&
        !isWasteWaterName(line.costTypeName),
      text: consumptionNote,
    });
  }
  if (wasteWaterNote) {
    footnoteDefs.push({
      applies: (line) =>
        line.allocationKey === "per_consumption_m3" &&
        isWasteWaterName(line.costTypeName),
      text: wasteWaterNote,
    });
  }
  footnoteDefs.push({
    applies: (line) => line.bemessungUnit === "Personentage",
    text: t("statements.pdf.costTable.personDaysNote"),
  });
  const footnotes = numberFootnotes(lines, footnoteDefs);

  return (
    <View>
      <View style={styles.table}>
        <View style={styles.rowHeader}>
          <View style={[styles.cellLeft, COL_LABEL]}>
            <Text>{t("statements.pdf.costTable.costTypeAllocation")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, COL_TOTAL_COSTS]}>
            <Text>{t("statements.pdf.costTable.totalCosts")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, COL_BEMESSUNG]}>
            <Text>{t("statements.pdf.costTable.bemessung")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, COL_TAGE]}>
            <Text>{t("statements.pdf.costTable.tage")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, COL_AMOUNT]}>
            <Text>{t("statements.pdf.costTable.yourCosts")}</Text>
          </View>
        </View>

        {lines.map((line) => {
          const isHeating = line.allocationKey === "heating_ordinance";
          const isFixed = line.allocationKey === "fixed";
          const hasBemessung =
            line.bemessungTotal !== null &&
            line.bemessungTotal !== undefined &&
            line.bemessungTenant !== null &&
            line.bemessungTenant !== undefined;
          const hasDays =
            line.daysTotal !== null &&
            line.daysTotal !== undefined &&
            line.daysTenant !== null &&
            line.daysTenant !== undefined;

          const markerText = footnotes
            .filter((fn) => fn.applies(line))
            .map((fn) => fn.marker)
            .join("");
          const noteSuffix = markerText ? ` ${markerText}` : "";

          return (
            <View
              key={line.costTypeName}
              style={[styles.row, styles.rowDivider]}
            >
              <View style={[styles.cellLeft, COL_LABEL]}>
                <Text>
                  {renderSuperscripts(`${line.costTypeName}${noteSuffix}`)}
                  <Text style={styles.operator}>
                    {`\n${t(allocationLabelKey[line.allocationKey])}`}
                  </Text>
                </Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, COL_TOTAL_COSTS]}
              >
                <Text>
                  {`${formatEur(line.totalAmountCents)} `}
                  <Text style={styles.operator}>
                    {isFixed
                      ? t("statements.pdf.costTable.operatorEquals")
                      : t("statements.pdf.costTable.operatorMultiply")}
                  </Text>
                </Text>
              </View>
              <View
                style={[
                  styles.cellRight,
                  styles.cellDivider,
                  COL_BEMESSUNG,
                  { flexDirection: "row", alignItems: "center" },
                ]}
              >
                {isHeating ? (
                  <Text style={{ flex: 1, textAlign: "right" }}>
                    {renderSuperscripts(line.baseUnit)}
                  </Text>
                ) : (
                  <View style={styles.fractionStack}>
                    <Text style={styles.fractionTop}>
                      {hasBemessung
                        ? renderSuperscripts(
                            fmtBemessung(
                              line.bemessungTenant as number,
                              line.bemessungUnit,
                            ),
                          )
                        : ""}
                    </Text>
                    <Text style={styles.fractionBottom}>
                      {hasBemessung
                        ? renderSuperscripts(
                            fmtBemessung(
                              line.bemessungTotal as number,
                              line.bemessungUnit,
                            ),
                          )
                        : ""}
                    </Text>
                  </View>
                )}
                {!isFixed && (
                  <Text style={styles.fractionOperator}>
                    {hasDays
                      ? t("statements.pdf.costTable.operatorMultiply")
                      : t("statements.pdf.costTable.operatorEquals")}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.cellRight,
                  styles.cellDivider,
                  COL_TAGE,
                  { flexDirection: "row", alignItems: "center" },
                ]}
              >
                {hasDays ? (
                  <>
                    <View style={styles.fractionStack}>
                      <Text style={styles.fractionTop}>{line.daysTenant}</Text>
                      <Text style={styles.fractionBottom}>
                        {line.daysTotal}
                      </Text>
                    </View>
                    <Text style={styles.fractionOperator}>
                      {t("statements.pdf.costTable.operatorEquals")}
                    </Text>
                  </>
                ) : null}
              </View>
              <View style={[styles.cellRight, styles.cellDivider, COL_AMOUNT]}>
                <Text>{formatEur(line.tenantAmountCents)}</Text>
              </View>
            </View>
          );
        })}

        <View style={[styles.row, styles.rowDividerStrong, styles.bold]}>
          <View style={[styles.cellLeft, COL_TOTAL_LABEL]}>
            <Text>{t("statements.pdf.costTable.total")}</Text>
          </View>
          <View style={[styles.cellRight, COL_AMOUNT]}>
            <Text>{formatEur(totalCostsCents)}</Text>
          </View>
        </View>
      </View>
      {footnotes.map((fn) => (
        <Text key={fn.marker} style={styles.footnote}>
          {renderSuperscripts(`${fn.marker} ${fn.text}`)}
        </Text>
      ))}
    </View>
  );
};
