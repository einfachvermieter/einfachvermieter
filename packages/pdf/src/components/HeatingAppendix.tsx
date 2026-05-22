import {
  co2TierLabel,
  degreeDaysMonthlyBreakdown,
  formatEur,
  formatNumber,
  type HeatingDetail,
  HKVO_DEGREE_DAYS_PROMILLE_PER_MONTH,
  landlordShareRow,
  type Period,
  perMeterDisplayDigits,
  prepareHeatingDisplay,
} from "@einfachvermieter/shared";
import { Text, View } from "@react-pdf/renderer";
import { calcWarningKey, formatCalcWarning } from "../calcWarnings.js";
import { t } from "../i18n.js";
import { styles } from "../styles.js";
import { renderSuperscripts, toSuperscript } from "../superscript.js";

type Props = {
  detail: HeatingDetail;
  /**
   * Mietzeit (= effektive Heizkosten-Periode). Wird für die Liste der
   * bewohnten Monate im Gradtagszahlen-Hinweis benötigt.
   */
  tenantPeriod: Period;
  /**
   * Volle Abrechnungsperiode. Deckt sich die Mietzeit damit (Mieter war den
   * gesamten Zeitraum wohnhaft), entfällt der Hinweis zur zeitanteiligen
   * Verteilung. Dann findet keine Abgrenzung statt.
   */
  statementPeriod: Period;
  /**
   * Wohnung des Mieters dieser Abrechnung. Die Detail-HKV-Liste wird
   * auf diese Wohnung eingegrenzt, damit fremde Mieter aus Datenschutz-
   * gründen keine Einzelverbräuche anderer Wohnungen sehen.
   */
  targetUnitId: string;
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
];

// Layout-Werte für die Tabellen in diesem Anhang.
const BREAKDOWN_COL_LABEL = { flex: 3 };
const BREAKDOWN_COL_AMOUNT = { flex: 1 };

// CO2-Aufteilungstabelle: Label-Spalte (Header-Zellen links) + Wertspalte.
const CO2_COL_LABEL = { flex: 1 };
const CO2_COL_VALUE = { flex: 1 };

const METER_COL_NAME = { flex: 1.8 };
const METER_COL_UNIT = { flex: 1.2 };
const METER_COL_NUM = { flex: 1 };

const DIST_COL_UNIT = { flex: 1.6 };
const DIST_COL_AREA = { flex: 1 };
const DIST_COL_NUM = { flex: 1 };
const DIST_COL_TOTAL = { flex: 1.2 };

/**
 * Liste der bewohnten Monate mit ihrem festen HKVO-Monatsanteil (Anlage zu
 * § 9 Abs. 3 HeizkostenV), z. B. "Jan 170 ‰, Feb 150 ‰". Nur Monate, in die
 * die Mietzeit (teilweise) fällt, werden aufgeführt. Dient als {months}-
 * Platzhalter im Gradtagszahlen-Hinweis.
 */
const residentMonthsPromille = (period: Period): string =>
  degreeDaysMonthlyBreakdown(period)
    .filter((row) => row.calendarDays > 0)
    .map(
      (row) =>
        `${t(`common.monthsShort.${MONTH_KEYS[row.monthIndex]}`)} ${formatNumber(
          HKVO_DEGREE_DAYS_PROMILLE_PER_MONTH[row.monthIndex] ?? 0,
          0,
        )} ‰`,
    )
    .join(", ");

/**
 * Zeitanteiligen Verteilung bei unterjähriger Nutzung. Wählt die passende
 * i18n-Vorlage nach zwei Achsen:
 * - Zwischenablesung (Verbrauch exakt über Zählerstände) -> nur Grundkosten
 *   werden zeitanteilig verteilt; ohne erfassten Verbrauch (`heating_area`)
 *   werden die gesamten Heizkosten zeitanteilig verteilt.
 * - Aufteilungsmethode `degree_days` (Gradtagszahlen) vs. `linear`
 *   (Nutzungstage). Bei `degree_days` werden die bewohnten Monatsanteile
 *   eingesetzt.
 */
const prorationNote = (detail: HeatingDetail, tenantPeriod: Period): string => {
  const distributesAll =
    (detail.consumptionDistributionMethod ?? "consumption") === "heating_area";

  if (detail.prorationMethod === "degree_days") {
    const months = residentMonthsPromille(tenantPeriod);
    return distributesAll
      ? t("statements.pdf.heating.prorationNoteDegreeDaysAll", { months })
      : t("statements.pdf.heating.prorationNoteDegreeDaysBase", { months });
  }

  return distributesAll
    ? t("statements.pdf.heating.prorationNoteLinearAll")
    : t("statements.pdf.heating.prorationNoteLinearBase");
};

const distributionConsumptionHeader = (
  method: HeatingDetail["consumptionMethod"],
  useValuationPoints: boolean,
): string => {
  if (method !== "heat_cost_allocator") {
    return t("statements.pdf.heating.consumptionKwh");
  }
  return useValuationPoints
    ? t("statements.pdf.heating.consumptionUnits")
    : t("statements.pdf.heating.consumptionUnitsRaw");
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt am Markup
export const HeatingAppendix = ({
  detail,
  tenantPeriod,
  statementPeriod,
  targetUnitId,
}: Props) => {
  // Gemeinsames Anzeige-View-Model (WYSIWYG-Pflicht Web <-> PDF).
  const {
    consumptionPct,
    basicPct,
    isHkv,
    distributionMethod,
    totalConsumption,
    totalArea,
    useValuationPoints,
    heatingPotForDisplay,
    isPartialPeriod,
    hotWaterConsumptionPct,
    hotWaterBasicPct,
    formatAggregatedConsumption,
  } = prepareHeatingDisplay(detail, tenantPeriod, statementPeriod);

  // Spalten-Fußnoten in Spalten-Reihenfolge (Heizfläche -> Bewertungspunkte).
  // Werden nur angezeigt, wenn die jeweilige Bedingung erfüllt ist; die
  // Nummerierung läuft 1..N über die tatsächlich gezeigten Einträge.
  type ColumnFootnote = {
    key: "heatingArea" | "valuationPoints";
    text: string;
  };

  const columnFootnotes: ColumnFootnote[] = [];
  if (detail.heatingAreaDiffersFromLivingArea) {
    columnFootnotes.push({
      key: "heatingArea",
      text: t("statements.pdf.heating.heatingAreaNote"),
    });
  }

  if (useValuationPoints) {
    columnFootnotes.push({
      key: "valuationPoints",
      text: t("statements.pdf.heating.valuationPointsNote"),
    });
  }

  const markerFor = (key: ColumnFootnote["key"]): string => {
    const idx = columnFootnotes.findIndex((f) => f.key === key);
    return idx === -1 ? "" : toSuperscript(idx + 1);
  };

  const heatingAreaMarker = markerFor("heatingArea");
  const valuationPointsMarker = markerFor("valuationPoints");

  // Einzelne HKV/WMZ-Stände nur für die Wohnung des Mieters. Fremde
  // Wohnungen erscheinen nur aggregiert in der "Verteilung pro Wohnung"-
  // Tabelle (Datenschutz).
  const perMeter = (detail.perMeter ?? []).filter(
    (row) => row.unitId === targetUnitId,
  );

  const { consumptionRawDigits, kTotalDigits, consumptionWeightedDigits } =
    perMeterDisplayDigits(perMeter);

  // CO2KostAufG-Aufteilung (Wohngebäude). Nur gesetzt, wenn die Aufteilung
  // aktiv ist und CO2-Kosten + -Menge im Topf erfasst sind (siehe
  // calculateHeating). Dann erscheint links die Zusammensetzung (mit der
  // Abzugszeile "CO2-Kostenanteil Vermieter") und rechts daneben die
  // CO2-Aufteilungstabelle.
  const co2 = detail.co2Detail;

  // Warmwasser-Abspaltung (§ 9 Abs. 2 HeizkostenV). Ist sie aktiv, bezieht
  // sich die Heizungs-Verteilungstabelle nur noch auf den um das Warmwasser
  // reduzierten Topf; das Warmwasser erscheint in einer eigenen Sektion.
  const hw = detail.hotWaterDetail;

  // Aufschlüsselung der Heizkosten-Gesamtsumme nach Kostenarten, stellt
  // sicher, dass der Mieter nachvollziehen kann, woraus sich der "Heizkosten
  // gesamt"-Wert oben zusammensetzt. Die größte Position trägt den
  // i18n-Brennstoff-Namen (z. B. "Erdgas") statt des freien Cost-Type-Namens,
  // erfüllt gleichzeitig § 6a HeizkostenV (Pflichtangabe Energieträger).
  // Die Kostenarten-Zeilen summieren sich auf den Brutto-Topf;
  // die Abzugszeile schließt die Lücke zum verteilten Netto-Topf (= Summe).
  const breakdownTable =
    detail.costBreakdown && detail.costBreakdown.length > 0 ? (
      <View>
        <Text style={styles.sectionHeading}>
          {t("statements.pdf.heating.breakdown.title")}
        </Text>
        <View style={styles.table}>
          <View style={styles.rowHeader}>
            <View style={[styles.cellLeft, BREAKDOWN_COL_LABEL]}>
              <Text>{t("statements.pdf.heating.breakdown.position")}</Text>
            </View>
            <View
              style={[
                styles.cellRight,
                styles.cellDivider,
                BREAKDOWN_COL_AMOUNT,
              ]}
            >
              <Text>{t("statements.pdf.heating.breakdown.amount")}</Text>
            </View>
          </View>
          {detail.costBreakdown.map((row, idx) => {
            const label =
              idx === 0 && detail.fuelType
                ? t(`ui.heating.fuelTypes.${detail.fuelType}`)
                : row.label;
            return (
              <View key={row.label} style={[styles.row, styles.rowDivider]}>
                <View style={[styles.cellLeft, BREAKDOWN_COL_LABEL]}>
                  <Text>{label}</Text>
                </View>
                <View
                  style={[
                    styles.cellRight,
                    styles.cellDivider,
                    BREAKDOWN_COL_AMOUNT,
                  ]}
                >
                  <Text>{formatEur(row.amountCents)}</Text>
                </View>
              </View>
            );
          })}
          {co2 ? (
            <View style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeft, BREAKDOWN_COL_LABEL]}>
                <Text>
                  {t("statements.pdf.heating.breakdown.co2LandlordShare")}
                </Text>
              </View>
              <View
                style={[
                  styles.cellRight,
                  styles.cellDivider,
                  BREAKDOWN_COL_AMOUNT,
                ]}
              >
                <Text>{formatEur(-co2.landlordDeductionCents)}</Text>
              </View>
            </View>
          ) : null}
          <View style={[styles.row, styles.rowDividerStrong]}>
            <View style={[styles.cellLeft, styles.bold, BREAKDOWN_COL_LABEL]}>
              <Text>{t("statements.pdf.heating.breakdown.total")}</Text>
            </View>
            <View style={[styles.cellRight, styles.bold, BREAKDOWN_COL_AMOUNT]}>
              <Text>{formatEur(detail.totalHeatingCostsCents)}</Text>
            </View>
          </View>
        </View>
      </View>
    ) : null;

  // CO2-Aufteilungstabelle (Header-Zellen in der linken Spalte).
  // Einstufungs-Label (Stufe, in die der Gebäude-Ausstoß fällt), eine der
  // drei Bereichsformen (unterste/mittlere/oberste Stufe).
  const co2TierText = co2
    ? (() => {
        const label = co2TierLabel(co2.emissionsKgPerSqmYear);
        return t(label.key, label.params);
      })()
    : "";

  const co2Section = co2 ? (
    <View>
      <Text style={styles.sectionHeading}>
        {t("statements.pdf.heating.co2.title")}
      </Text>
      <View style={styles.table}>
        <View style={styles.row}>
          <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
            <Text>{t("statements.pdf.heating.co2.totalCost")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}>
            <Text>{formatEur(co2.totalCostCents)}</Text>
          </View>
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
            <Text>{t("statements.pdf.heating.co2.emissions")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}>
            <Text>
              {renderSuperscripts(
                `${formatNumber(co2.emissionsKgPerSqmYear, 1)} kg/m²a`,
              )}
            </Text>
          </View>
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
            <Text>{t("statements.pdf.heating.co2.tier")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}>
            <Text>{renderSuperscripts(co2TierText)}</Text>
          </View>
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
            <Text>{t("statements.pdf.heating.co2.sharePair")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}>
            <Text>{`${formatNumber(100 - co2.landlordSharePercent, 0)} % / ${formatNumber(co2.landlordSharePercent, 0)} %`}</Text>
          </View>
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
            <Text>{t("statements.pdf.heating.co2.landlordDeduction")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}>
            <Text>{formatEur(co2.landlordDeductionCents)}</Text>
          </View>
        </View>
      </View>
    </View>
  ) : null;

  // Warmwasser-Sektion (§ 9 Abs. 2 HeizkostenV): Zerlegung Q_WW/Q_gesamt plus
  // eigene Verteilungstabelle. DSGVO-Hybrid wie bei der Heizung, eigene
  // Wohnung detailliert, übrige aggregiert.
  const hotWaterSection = hw ? (
    <View>
      <Text style={styles.sectionHeading}>
        {t("statements.pdf.heating.hotWater.title")}
      </Text>
      <Text style={styles.paragraph}>
        {t(`statements.pdf.heating.hotWater.method.${hw.method}`, {
          heat: formatNumber(hw.hotWaterHeatKwh, 0),
          total: formatNumber(hw.totalHeatEnergyKwh, 0),
          share: formatNumber(hw.hotWaterShareBps / 100, 1),
          pot: formatEur(hw.hotWaterPotCents),
        })}
      </Text>
      <View style={styles.table}>
        <View style={styles.rowHeader}>
          <View style={[styles.cellLeft, DIST_COL_UNIT]}>
            <Text>{t("statements.pdf.heating.unit")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
            <Text>{t("statements.pdf.heating.hotWater.consumptionM3")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
            <Text>
              {t("statements.pdf.heating.consumptionShareHeader", {
                percent: formatNumber(hotWaterConsumptionPct, 0),
              })}
            </Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
            <Text>
              {t("statements.pdf.heating.basicShareHeader", {
                percent: formatNumber(hotWaterBasicPct, 0),
              })}
            </Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, DIST_COL_TOTAL]}>
            <Text>{t("statements.pdf.heating.total")}</Text>
          </View>
        </View>
        {(() => {
          const target = hw.perUnit.find((u) => u.unitId === targetUnitId);
          const others = hw.perUnit.filter((u) => u.unitId !== targetUnitId);
          type HwRow = {
            key: string;
            label: string;
            hotWaterM3: number;
            consumptionCostCents: number;
            basicCostCents: number;
            totalCents: number;
          };
          const rows: HwRow[] = [];
          if (target) {
            rows.push({
              key: target.unitId,
              label: t("statements.pdf.heating.targetUnitLabel", {
                unit: target.unitName,
              }),
              hotWaterM3: target.hotWaterM3,
              consumptionCostCents: target.consumptionCostCents,
              basicCostCents: target.basicCostCents,
              totalCents: target.totalCents,
            });
          }
          if (others.length > 0) {
            rows.push({
              key: "other-units",
              label:
                others.length === 1 && others[0]
                  ? others[0].unitName
                  : t("statements.pdf.heating.otherUnitsPlural", {
                      count: others.length,
                    }),
              hotWaterM3: others.reduce((acc, u) => acc + u.hotWaterM3, 0),
              consumptionCostCents: others.reduce(
                (acc, u) => acc + u.consumptionCostCents,
                0,
              ),
              basicCostCents: others.reduce(
                (acc, u) => acc + u.basicCostCents,
                0,
              ),
              totalCents: others.reduce((acc, u) => acc + u.totalCents, 0),
            });
          }
          return rows.map((row) => (
            <View key={row.key} style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeft, DIST_COL_UNIT]}>
                <Text>{row.label}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
              >
                <Text>
                  {renderSuperscripts(`${formatNumber(row.hotWaterM3, 2)} m³`)}
                </Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
              >
                <Text>{formatEur(row.consumptionCostCents)}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
              >
                <Text>{formatEur(row.basicCostCents)}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_TOTAL]}
              >
                <Text>{formatEur(row.totalCents)}</Text>
              </View>
            </View>
          ));
        })()}
        {(() => {
          // Vermieteranteil (Leerstand/Mieterwechsel), damit die Zeilen
          // sichtbar auf "Haus gesamt" aufsummieren.
          const landlord = landlordShareRow(hw);
          if (!landlord) {
            return null;
          }
          return (
            <View style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeft, DIST_COL_UNIT]}>
                <Text>{t("statements.pdf.heating.landlordShare")}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
              >
                <Text>{t("ui.common.emptyValue")}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
              >
                <Text>{formatEur(landlord.consumptionCostCents)}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
              >
                <Text>{formatEur(landlord.basicCostCents)}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_TOTAL]}
              >
                <Text>{formatEur(landlord.totalCents)}</Text>
              </View>
            </View>
          );
        })()}
        <View style={[styles.row, styles.rowDividerStrong]}>
          <View style={[styles.cellLeft, styles.bold, DIST_COL_UNIT]}>
            <Text>{t("statements.pdf.heating.totalHouse")}</Text>
          </View>
          <View
            style={[
              styles.cellRight,
              styles.bold,
              styles.cellDivider,
              DIST_COL_NUM,
            ]}
          >
            <Text>
              {renderSuperscripts(
                `${formatNumber(
                  hw.perUnit.reduce((acc, u) => acc + u.hotWaterM3, 0),
                  2,
                )} m³`,
              )}
            </Text>
          </View>
          <View
            style={[
              styles.cellRight,
              styles.bold,
              styles.cellDivider,
              DIST_COL_NUM,
            ]}
          >
            <Text>{formatEur(hw.consumptionPortionCents)}</Text>
          </View>
          <View
            style={[
              styles.cellRight,
              styles.bold,
              styles.cellDivider,
              DIST_COL_NUM,
            ]}
          >
            <Text>{formatEur(hw.basicPortionCents)}</Text>
          </View>
          <View
            style={[
              styles.cellRight,
              styles.bold,
              styles.cellDivider,
              DIST_COL_TOTAL,
            ]}
          >
            <Text>{formatEur(hw.hotWaterPotCents)}</Text>
          </View>
        </View>
      </View>
      {hw.consumptionDistributionMethod === "heating_area" ? (
        <Text style={styles.footnote}>
          {t("statements.pdf.heating.hotWater.consumptionFallbackArea")}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View>
      {breakdownTable && co2Section ? (
        <View wrap={false} style={styles.twoColumnRow}>
          <View style={styles.twoColumnLeft}>{breakdownTable}</View>
          <View style={styles.twoColumnRight}>{co2Section}</View>
        </View>
      ) : (
        <View wrap={false}>
          {breakdownTable}
          {co2Section}
        </View>
      )}

      <Text style={styles.sectionHeading}>
        {isHkv
          ? t("statements.pdf.heating.perMeterHeadingHkv")
          : t("statements.pdf.heating.perMeterHeading")}
      </Text>
      {perMeter.length === 0 ? (
        <Text style={styles.paragraph}>
          {t("statements.pdf.heating.perMeterEmpty")}
        </Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.rowHeader}>
            <View style={[styles.cellLeft, METER_COL_NAME]}>
              <Text>{t("statements.pdf.heating.perMeterMeter")}</Text>
            </View>
            <View style={[styles.cellLeft, styles.cellDivider, METER_COL_UNIT]}>
              <Text>{t("statements.pdf.heating.perMeterSerial")}</Text>
            </View>
            <View style={[styles.cellRight, styles.cellDivider, METER_COL_NUM]}>
              <Text>{t("statements.pdf.heating.perMeterDelta")}</Text>
            </View>
            {isHkv ? (
              <View
                style={[styles.cellRight, styles.cellDivider, METER_COL_NUM]}
              >
                <Text>{t("statements.pdf.heating.perMeterKTotal")}</Text>
              </View>
            ) : null}
            <View style={[styles.cellRight, styles.cellDivider, METER_COL_NUM]}>
              <Text>{t("statements.pdf.heating.perMeterWeighted")}</Text>
            </View>
          </View>
          {perMeter.map((row) => (
            <View key={row.meterId} style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeft, METER_COL_NAME]}>
                <Text>
                  {isHkv
                    ? row.meterLabel
                        .replace(/^Heizkostenverteiler\s*/u, "")
                        .trim() || row.meterLabel
                    : row.meterLabel}
                </Text>
              </View>
              <View
                style={[styles.cellLeft, styles.cellDivider, METER_COL_UNIT]}
              >
                <Text>{row.serialNumber ?? t("ui.common.emptyValue")}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, METER_COL_NUM]}
              >
                <Text>
                  {`${formatNumber(row.consumptionRaw, consumptionRawDigits)}${isHkv ? " " : ""}`}
                  {isHkv ? (
                    <Text style={styles.operator}>
                      {t("statements.pdf.costTable.operatorMultiply")}
                    </Text>
                  ) : null}
                </Text>
              </View>
              {isHkv ? (
                <View
                  style={[styles.cellRight, styles.cellDivider, METER_COL_NUM]}
                >
                  <Text>
                    {row.kTotal === null || row.kTotal === undefined
                      ? t("ui.common.emptyValue")
                      : formatNumber(row.kTotal, kTotalDigits)}{" "}
                    <Text style={styles.operator}>
                      {t("statements.pdf.costTable.operatorEquals")}
                    </Text>
                  </Text>
                </View>
              ) : null}
              <View
                style={[styles.cellRight, styles.cellDivider, METER_COL_NUM]}
              >
                <Text>
                  {formatNumber(
                    row.consumptionWeighted,
                    consumptionWeightedDigits,
                  )}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Verteilung pro Wohnung, Heading + Header + Zeilen zusammen,
          damit react-pdf den Block nicht zwischen Heading und Tabelle
          umbricht. Bei üblicher Wohnungsanzahl (2-10) passt das auf eine
          Seite. */}
      <View wrap={false}>
        <Text style={styles.sectionHeading}>
          {t("statements.pdf.heating.distributionPerUnit")}
        </Text>
        <View style={styles.table}>
          <View style={styles.rowHeader}>
            <View style={[styles.cellLeft, DIST_COL_UNIT]}>
              <Text>{t("statements.pdf.heating.unit")}</Text>
            </View>
            <View style={[styles.cellRight, styles.cellDivider, DIST_COL_AREA]}>
              <Text>
                {t("statements.pdf.heating.heatingArea")}
                {renderSuperscripts(heatingAreaMarker)}
              </Text>
            </View>
            <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
              <Text>
                {distributionConsumptionHeader(
                  detail.consumptionMethod,
                  useValuationPoints,
                )}
                {renderSuperscripts(valuationPointsMarker)}
              </Text>
            </View>
            <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
              <Text>
                {t("statements.pdf.heating.consumptionShareHeader", {
                  percent: formatNumber(consumptionPct, 0),
                })}
              </Text>
            </View>
            <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
              <Text>
                {t("statements.pdf.heating.basicShareHeader", {
                  percent: formatNumber(basicPct, 0),
                })}
              </Text>
            </View>
            <View
              style={[styles.cellRight, styles.cellDivider, DIST_COL_TOTAL]}
            >
              <Text>{t("statements.pdf.heating.total")}</Text>
            </View>
          </View>
          {(() => {
            // Hybrid-Ansicht: Mieter-eigene Wohnung detailliert, alle
            // anderen anonym aggregiert (Datenschutz)
            const target = detail.perUnit.find(
              (u) => u.unitId === targetUnitId,
            );

            const others = detail.perUnit.filter(
              (u) => u.unitId !== targetUnitId,
            );

            type DistRow = {
              key: string;
              label: string;
              areaSqm: number;
              consumptionKwh: number;
              consumptionCostCents: number;
              basicCostCents: number;
              totalCents: number;
            };

            const rows: DistRow[] = [];

            if (target) {
              rows.push({
                key: target.unitId,
                label: t("statements.pdf.heating.targetUnitLabel", {
                  unit: target.unitName,
                }),
                areaSqm: target.areaSqm,
                consumptionKwh: target.consumptionKwh,
                consumptionCostCents: target.consumptionCostCents,
                basicCostCents: target.basicCostCents,
                totalCents: target.totalCents,
              });
            }

            if (others.length > 0) {
              // Bei genau einer anderen Wohnung wird deren Name gezeigt.
              // DSGVO ist hier wirkungslos, weil der Mieter ohnehin weiß, wer
              // nebenan wohnt; Ab zwei weiteren Wohnungen wird anonym
              // aggregiert.
              rows.push({
                key: "other-units",
                label:
                  others.length === 1 && others[0]
                    ? others[0].unitName
                    : t("statements.pdf.heating.otherUnitsPlural", {
                        count: others.length,
                      }),
                areaSqm: others.reduce((acc, u) => acc + u.areaSqm, 0),
                consumptionKwh: others.reduce(
                  (acc, u) => acc + u.consumptionKwh,
                  0,
                ),
                consumptionCostCents: others.reduce(
                  (acc, u) => acc + u.consumptionCostCents,
                  0,
                ),
                basicCostCents: others.reduce(
                  (acc, u) => acc + u.basicCostCents,
                  0,
                ),
                totalCents: others.reduce((acc, u) => acc + u.totalCents, 0),
              });
            }
            return rows.map((row) => (
              <View key={row.key} style={[styles.row, styles.rowDivider]}>
                <View style={[styles.cellLeft, DIST_COL_UNIT]}>
                  <Text>{row.label}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_AREA]}
                >
                  <Text>
                    {renderSuperscripts(`${formatNumber(row.areaSqm, 2)} m²`)}
                  </Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>{formatAggregatedConsumption(row.consumptionKwh)}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>{formatEur(row.consumptionCostCents)}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>{formatEur(row.basicCostCents)}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_TOTAL]}
                >
                  <Text>{formatEur(row.totalCents)}</Text>
                </View>
              </View>
            ));
          })()}
          {(() => {
            // Vermieteranteil (Leerstand/Mieterwechsel), damit die Zeilen
            // sichtbar auf "Haus gesamt" aufsummieren.
            const landlord = landlordShareRow(detail);
            if (!landlord) {
              return null;
            }
            return (
              <View style={[styles.row, styles.rowDivider]}>
                <View style={[styles.cellLeft, DIST_COL_UNIT]}>
                  <Text>{t("statements.pdf.heating.landlordShare")}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_AREA]}
                >
                  <Text>{t("ui.common.emptyValue")}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>{t("ui.common.emptyValue")}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>{formatEur(landlord.consumptionCostCents)}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>{formatEur(landlord.basicCostCents)}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_TOTAL]}
                >
                  <Text>{formatEur(landlord.totalCents)}</Text>
                </View>
              </View>
            );
          })()}
          {/* "Haus gesamt": Summenzeile der Verteilungstabelle (vormals
              die separate Übersichtstabelle). EUR-Werte aus den maßgeblichen
              Gesamtsummen, nicht aus den gerundeten Zeilenwerten
              aufsummiert. */}
          <View style={[styles.row, styles.rowDividerStrong]}>
            <View style={[styles.cellLeft, styles.bold, DIST_COL_UNIT]}>
              <Text>{t("statements.pdf.heating.totalHouse")}</Text>
            </View>
            <View
              style={[
                styles.cellRight,
                styles.bold,
                styles.cellDivider,
                DIST_COL_AREA,
              ]}
            >
              <Text>
                {renderSuperscripts(`${formatNumber(totalArea, 2)} m²`)}
              </Text>
            </View>
            <View
              style={[
                styles.cellRight,
                styles.bold,
                styles.cellDivider,
                DIST_COL_NUM,
              ]}
            >
              <Text>{formatAggregatedConsumption(totalConsumption)}</Text>
            </View>
            <View
              style={[
                styles.cellRight,
                styles.bold,
                styles.cellDivider,
                DIST_COL_NUM,
              ]}
            >
              <Text>{formatEur(detail.consumptionPortionCents)}</Text>
            </View>
            <View
              style={[
                styles.cellRight,
                styles.bold,
                styles.cellDivider,
                DIST_COL_NUM,
              ]}
            >
              <Text>{formatEur(detail.basicPortionCents)}</Text>
            </View>
            <View
              style={[
                styles.cellRight,
                styles.bold,
                styles.cellDivider,
                DIST_COL_TOTAL,
              ]}
            >
              <Text>{formatEur(heatingPotForDisplay)}</Text>
            </View>
          </View>
        </View>
        {/* Nummerierte Spalten-Fußnoten in Spalten-Reihenfolge (Heizfläche,
            Bewertungspunkte, Verbrauchs-/Grundkosten-Aufteilung). Danach
            folgen freischwebende Hinweise ohne Spalten-Marker: ersatzweise
            Verteilung nach Heizfläche und der Methodik-Hinweis. */}
        {columnFootnotes.map((footnote, idx) => (
          <Text key={footnote.key} style={styles.footnote}>
            {renderSuperscripts(`${toSuperscript(idx + 1)} ${footnote.text}`)}
          </Text>
        ))}
        {distributionMethod === "heating_area" ? (
          <Text style={styles.footnote}>
            {t("statements.pdf.heating.consumptionDistributionHeatingArea")}
          </Text>
        ) : null}
        {/* Hinweis zur zeitanteiligen Verteilung, nur bei unterjähriger
            Nutzung (Mietzeit != Abrechnungsperiode) und nur bei interner
            Berechnung (im external-Modus ist `prorationMethod` undefiniert,
            dort hat der Dienstleister die Verteilung übernommen). Bei voller
            Nutzung findet keine Abgrenzung statt. Dann entfällt der Hinweis. */}
        {detail.prorationMethod !== undefined && isPartialPeriod ? (
          <Text style={styles.footnote}>
            {prorationNote(detail, tenantPeriod)}
          </Text>
        ) : null}
        {/* Berechnungs-Hinweise aus der Calc-Schicht, v. a. die rechtlich
            gebotene Kennzeichnung geschätzter bzw. fehlender Ablesewerte. */}
        {(detail.warnings ?? []).map((warning) => (
          <Text key={calcWarningKey(warning)} style={styles.footnote}>
            {formatCalcWarning(warning)}
          </Text>
        ))}
      </View>

      {hotWaterSection}
    </View>
  );
};
