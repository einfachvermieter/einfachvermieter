import {
  co2TenantShareCents,
  co2TierLabel,
  degreeDaysMonthlyBreakdown,
  formatEur,
  formatNumber,
  groupCalcWarnings,
  type HeatingDetail,
  HKVO_DEGREE_DAYS_PROMILLE_PER_MONTH,
  heatingColumnFootnotes,
  hotWaterColumnFootnotes,
  hotWaterFactRows,
  isTenantWarning,
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
 * Flächen-Fallback: die drei Kostenspalten (Verbrauch + Fläche + Summe)
 * zu einer "100 % nach Fläche"-Spalte zusammengefasst. In der Heizungstabelle
 * mit gleicher Gesamtbreite (3.2); in der Warmwassertabelle, die dann nur noch
 * zwei Spalten hat (Wohnung + Betrag), stattdessen 50/50 (DIST_COL_HALF).
 */
const DIST_COL_MERGED = { flex: 3.2 };
const DIST_COL_HALF = { flex: 1 };

/**
 * Wert-Zellen der Verteilungstabellen. Im Flächen-Fallback  (keine Zähler) eine
 * zusammengefasste "100 % nach Fläche"-Zelle (= Gesamtbetrag), sonst die
 * getrennten Spalten Verbrauch / Fläche / Summe.
 */
const distributionValueCells = (
  consumptionCents: number,
  basicCents: number,
  totalCents: number,
  merged: boolean,
  opts: {
    boldTotal?: boolean;
    boldAll?: boolean;
    mergedCol?: { flex: number };
  },
) => {
  const totalStyle = opts.boldTotal || opts.boldAll ? styles.bold : undefined;
  const numStyle = opts.boldAll ? styles.bold : undefined;
  if (merged) {
    return (
      <View
        style={[
          styles.cellRight,
          styles.cellDivider,
          opts.mergedCol ?? DIST_COL_MERGED,
        ]}
      >
        <Text style={totalStyle}>{formatEur(totalCents)}</Text>
      </View>
    );
  }
  return (
    <>
      <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
        <Text style={numStyle}>{formatEur(consumptionCents)}</Text>
      </View>
      <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
        <Text style={numStyle}>{formatEur(basicCents)}</Text>
      </View>
      <View style={[styles.cellRight, styles.cellDivider, DIST_COL_TOTAL]}>
        <Text style={totalStyle}>{formatEur(totalCents)}</Text>
      </View>
    </>
  );
};

/**
 * Hochgestellte Fußnoten-Marker am Referenzort (Spaltenkopf)
 */
const footnoteMarkers = (indices: number[]) =>
  indices.length > 0 ? (
    <Text style={styles.superscript}>{indices.join(", ")}</Text>
  ) : null;

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

/**
 * Rechte Info-Tabelle des Heizkosten-Anhangs: Energieträger als erste Zeile,
 * darunter die CO2-Kostenaufteilung. Nur aufrufen, wenn Energieträger bekannt
 * oder CO2 aufgeteilt ist (sonst wäre die Tabelle leer).
 */
const EnergyAndCo2Table = ({
  fuelType,
  co2,
  tenantCo2Cents,
}: {
  fuelType: HeatingDetail["fuelType"];
  co2: HeatingDetail["co2Detail"];
  /**
   * Auf den Mieter entfallender CO2-Kostenanteil (§ 7 Abs. 3 CO2KostAufG),
   * `null` wenn nicht ermittelbar.
   */
  tenantCo2Cents: number | null;
}) => {
  // Einstufungs-Label (Stufe, in die der Gebäude-Ausstoß fällt).
  const co2TierText = co2
    ? (() => {
        const label = co2TierLabel(co2.emissionsKgPerSqmYear);
        return t(label.key, label.params);
      })()
    : "";

  return (
    <View>
      <Text style={styles.sectionHeading}>
        {co2
          ? t("statements.pdf.heating.co2.title")
          : t("statements.pdf.heating.energySource")}
      </Text>
      <View style={styles.table}>
        {fuelType ? (
          <View style={styles.row}>
            <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
              <Text>{t("statements.pdf.heating.energySource")}</Text>
            </View>
            <View style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}>
              <Text>{t(`ui.heating.fuelTypes.${fuelType}`)}</Text>
            </View>
          </View>
        ) : null}
        {co2 ? (
          <>
            <View style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
                <Text>{t("statements.pdf.heating.co2.totalCost")}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}
              >
                <Text>{formatEur(co2.totalCostCents)}</Text>
              </View>
            </View>
            <View style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
                <Text>{t("statements.pdf.heating.co2.emissions")}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}
              >
                <Text>
                  {renderSuperscripts(
                    `${formatNumber(co2.emissionsKgPerSqmYear, 1)} kg/m²a`,
                  )}
                </Text>
              </View>
            </View>
            <View style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
                <Text>{t("statements.pdf.heating.co2.amount")}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}
              >
                <Text>
                  {t("statements.pdf.heating.co2.amountValue", {
                    value: formatNumber(co2.totalAmountGrams / 1000, 0),
                  })}
                </Text>
              </View>
            </View>
            {co2.livingAreaSqm === undefined ? null : (
              <View style={[styles.row, styles.rowDivider]}>
                <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
                  <Text>{t("statements.pdf.heating.co2.areaBasis")}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}
                >
                  <Text>
                    {renderSuperscripts(
                      t("statements.pdf.heating.co2.areaBasisValue", {
                        value: formatNumber(co2.livingAreaSqm, 0),
                      }),
                    )}
                  </Text>
                </View>
              </View>
            )}
            <View style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
                <Text>{t("statements.pdf.heating.co2.tier")}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}
              >
                <Text>{renderSuperscripts(co2TierText)}</Text>
              </View>
            </View>
            <View style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
                <Text>{t("statements.pdf.heating.co2.sharePair")}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}
              >
                <Text>{`${formatNumber(100 - co2.landlordSharePercent, 0)} % / ${formatNumber(co2.landlordSharePercent, 0)} %`}</Text>
              </View>
            </View>
            <View style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
                <Text>{t("statements.pdf.heating.co2.landlordDeduction")}</Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}
              >
                <Text>{formatEur(co2.landlordDeductionCents)}</Text>
              </View>
            </View>
            {tenantCo2Cents === null ? null : (
              <View style={[styles.row, styles.rowDivider]}>
                <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
                  <Text>{t("statements.pdf.heating.co2.tenantShare")}</Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}
                >
                  <Text>{formatEur(tenantCo2Cents)}</Text>
                </View>
              </View>
            )}
          </>
        ) : null}
      </View>
    </View>
  );
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt am Markup
export const HeatingAppendix = ({
  detail,
  tenantPeriod,
  statementPeriod,
  targetUnitId,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Spiegel der PDF-Anlage, viele optionale Spalten/Zeilen.
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
    hotWaterSharePct,
    heatingSharePct,
    formatAggregatedConsumption,
  } = prepareHeatingDisplay(detail, tenantPeriod, statementPeriod);

  // Nummerierte Spalten-Fußnoten (Heizfläche -> Bewertungspunkte -> Summe),
  // gemeinsame Quelle mit der Web-Karte. Marker am jeweiligen Spaltenkopf.
  const columnFootnotes = heatingColumnFootnotes(
    detail,
    useValuationPoints,
    heatingSharePct,
  );

  // Mehrere Fußnoten dürfen auf dieselbe Spalte zeigen (z. B. Summe: Anteil +
  // Flächen-Fallback); die Marker werden am Spaltenkopf durch Komma getrennt.
  const heatingIndices = (
    column: (typeof columnFootnotes)[number]["column"],
  ): number[] =>
    columnFootnotes.filter((f) => f.column === column).map((f) => f.index);

  // Flächen-Fallback: Verbrauchs- und Grundkostenspalte zu einer
  // "100 % nach Fläche"-Spalte zusammenfassen (mangels Verbrauchsmessern).
  const heatingMerged = distributionMethod === "heating_area";

  // Einzelne HKV/WMZ-Stände nur für die Wohnung des Mieters. Fremde
  // Wohnungen erscheinen nur aggregiert in der "Verteilung pro Wohnung"-
  // Tabelle (Datenschutz).
  const perMeter = (detail.perMeter ?? []).filter(
    (row) => row.unitId === targetUnitId,
  );

  const { consumptionRawDigits, kTotalDigits, consumptionWeightedDigits } =
    perMeterDisplayDigits(perMeter);
  const hasDerivedMeter = perMeter.some(
    (row) => row.consumptionIsDerived === true,
  );

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

  // Ohne Warmwasserzähler (Verteilung nach Fläche) sind alle m3-Werte 0,00;
  // die Spalte entfällt, und Verbrauchs-/Grundkostenspalte werden zu einer
  // "100 % nach Fläche"-Spalte zusammengefasst (Fußnote erklärt es).
  const showHotWaterM3 =
    hw?.consumptionDistributionMethod !== undefined &&
    hw.consumptionDistributionMethod !== "heating_area";
  const wwMerged = hw?.consumptionDistributionMethod === "heating_area";
  // Im Fallback bleiben nur zwei Spalten (Wohnung + Betrag) -> je 50 %.
  const wwUnitCol = wwMerged ? DIST_COL_HALF : DIST_COL_UNIT;
  const wwFootnotes = hw ? hotWaterColumnFootnotes(hw, hotWaterSharePct) : [];
  const wwIndices = wwFootnotes.map((note) => note.index);

  // "Ihre Heizkosten"-Introzeile: Heizungs- und Warmwasseranteil der eigenen
  // Wohnung zusammengefasst. Nur wenn Warmwasser abgespalten ist
  const ownHeatingUnit = detail.perUnit.find((u) => u.unitId === targetUnitId);
  const ownHotWaterUnit = hw?.perUnit.find((u) => u.unitId === targetUnitId);
  // § 7 Abs. 3 CO2KostAufG: der auf den Mieter entfallende CO2-Kostenanteil
  // gehört ausdrücklich in die Abrechnung.
  const tenantCo2Cents = co2TenantShareCents(
    detail,
    (ownHeatingUnit?.totalCents ?? 0) + (ownHotWaterUnit?.totalCents ?? 0),
  );
  const yourHeatingIntro =
    hw && ownHeatingUnit && ownHotWaterUnit
      ? t("statements.pdf.heating.yourHeatingIntro", {
          total: formatEur(
            ownHeatingUnit.totalCents + ownHotWaterUnit.totalCents,
          ),
          heating: formatEur(ownHeatingUnit.totalCents),
          hotWater: formatEur(ownHotWaterUnit.totalCents),
        })
      : null;

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
          {detail.costBreakdown.map((row) => (
            <View key={row.label} style={[styles.row, styles.rowDivider]}>
              <View style={[styles.cellLeft, BREAKDOWN_COL_LABEL]}>
                <Text>{row.label}</Text>
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
          ))}
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
  const infoSection =
    co2 || detail.fuelType ? (
      <EnergyAndCo2Table
        fuelType={detail.fuelType}
        co2={co2}
        tenantCo2Cents={tenantCo2Cents}
      />
    ) : null;

  // Warmwasser-Sektion (§ 9 Abs. 2 HeizkostenV): Zerlegung Q_WW/Q_gesamt plus
  // eigene Verteilungstabelle. DSGVO-Hybrid wie bei der Heizung, eigene
  // Wohnung detailliert, übrige aggregiert.
  const hotWaterSection = hw ? (
    <View>
      <Text style={styles.sectionHeading}>
        {t("statements.pdf.heating.hotWater.title")}
      </Text>
      <View style={styles.table}>
        {hotWaterFactRows(hw).map((row, index) => (
          <View
            key={row.key}
            style={index === 0 ? styles.row : [styles.row, styles.rowDivider]}
          >
            <View style={[styles.cellLeftHeader, CO2_COL_LABEL]}>
              <Text>{t(row.label.key, row.label.params)}</Text>
            </View>
            <View style={[styles.cellRight, styles.cellDivider, CO2_COL_VALUE]}>
              <Text>{t(row.value.key, row.value.params)}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.table}>
        <View style={styles.rowHeader}>
          <View style={[styles.cellLeft, wwUnitCol]}>
            <Text>{t("statements.pdf.heating.unit")}</Text>
          </View>
          {showHotWaterM3 ? (
            <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
              <Text>{t("statements.pdf.heating.hotWater.consumptionM3")}</Text>
            </View>
          ) : null}
          {wwMerged ? (
            <View style={[styles.cellRight, styles.cellDivider, DIST_COL_HALF]}>
              <Text>
                {t("statements.pdf.heating.mergedAreaHeader")}
                {footnoteMarkers(wwIndices)}
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
              >
                <Text>
                  {t("statements.pdf.heating.consumptionShareHeader", {
                    percent: formatNumber(hotWaterConsumptionPct, 0),
                  })}
                </Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
              >
                <Text>
                  {t("statements.pdf.heating.basicShareHeader", {
                    percent: formatNumber(hotWaterBasicPct, 0),
                  })}
                </Text>
              </View>
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_TOTAL]}
              >
                <Text>
                  {t("statements.pdf.heating.total")}
                  {footnoteMarkers(wwIndices)}
                </Text>
              </View>
            </>
          )}
        </View>
        {(() => {
          const target = hw.perUnit.find((u) => u.unitId === targetUnitId);
          const others = hw.perUnit.filter((u) => u.unitId !== targetUnitId);
          type HwRow = {
            key: string;
            label: string;
            isTarget: boolean;
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
              isTarget: true,
              hotWaterM3: target.hotWaterM3,
              consumptionCostCents: target.consumptionCostCents,
              basicCostCents: target.basicCostCents,
              totalCents: target.totalCents,
            });
          }
          if (others.length > 0) {
            rows.push({
              key: "other-units",
              isTarget: false,
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
              <View style={[styles.cellLeft, wwUnitCol]}>
                <Text style={row.isTarget ? styles.bold : undefined}>
                  {row.label}
                </Text>
              </View>
              {showHotWaterM3 ? (
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>
                    {renderSuperscripts(
                      `${formatNumber(row.hotWaterM3, 2)} m³`,
                    )}
                  </Text>
                </View>
              ) : null}
              {distributionValueCells(
                row.consumptionCostCents,
                row.basicCostCents,
                row.totalCents,
                wwMerged,
                { boldTotal: row.isTarget, mergedCol: DIST_COL_HALF },
              )}
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
              <View style={[styles.cellLeft, wwUnitCol]}>
                <Text>{t("statements.pdf.heating.landlordShare")}</Text>
              </View>
              {showHotWaterM3 ? (
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>{t("ui.common.emptyValue")}</Text>
                </View>
              ) : null}
              {distributionValueCells(
                landlord.consumptionCostCents,
                landlord.basicCostCents,
                landlord.totalCents,
                wwMerged,
                { mergedCol: DIST_COL_HALF },
              )}
            </View>
          );
        })()}
        <View style={[styles.row, styles.rowDividerStrong]}>
          <View style={[styles.cellLeft, styles.bold, wwUnitCol]}>
            <Text>{t("statements.pdf.heating.totalHouse")}</Text>
          </View>
          {showHotWaterM3 ? (
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
          ) : null}
          {distributionValueCells(
            hw.consumptionPortionCents,
            hw.basicPortionCents,
            hw.hotWaterPotCents,
            wwMerged,
            { boldAll: true, mergedCol: DIST_COL_HALF },
          )}
        </View>
      </View>
      {wwFootnotes.map((footnote) => (
        <Text key={footnote.key} style={styles.footnote}>
          {renderSuperscripts(
            `${toSuperscript(footnote.index)} ${t(footnote.label.key, footnote.label.params)}`,
          )}
        </Text>
      ))}
    </View>
  ) : null;

  return (
    <View>
      {yourHeatingIntro ? (
        <Text style={styles.paragraph}>{yourHeatingIntro}</Text>
      ) : null}
      {breakdownTable && infoSection ? (
        <View wrap={false} style={styles.twoColumnRow}>
          <View style={styles.twoColumnLeft}>{breakdownTable}</View>
          <View style={styles.twoColumnRight}>{infoSection}</View>
        </View>
      ) : (
        <View wrap={false}>
          {breakdownTable}
          {infoSection}
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
                  {row.consumptionIsDerived === true
                    ? footnoteMarkers([1])
                    : null}
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
      {hasDerivedMeter ? (
        <Text style={styles.footnote}>
          {`${toSuperscript(1)} ${t("statements.pdf.heating.perMeterDerivedNote")}`}
        </Text>
      ) : null}

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
                {footnoteMarkers(heatingIndices("heatingArea"))}
              </Text>
            </View>
            <View style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}>
              <Text>
                {distributionConsumptionHeader(
                  detail.consumptionMethod,
                  useValuationPoints,
                )}
                {footnoteMarkers(heatingIndices("consumption"))}
              </Text>
            </View>
            {heatingMerged ? (
              <View
                style={[styles.cellRight, styles.cellDivider, DIST_COL_MERGED]}
              >
                <Text>
                  {t("statements.pdf.heating.mergedAreaHeader")}
                  {footnoteMarkers(heatingIndices("total"))}
                </Text>
              </View>
            ) : (
              <>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>
                    {t("statements.pdf.heating.consumptionShareHeader", {
                      percent: formatNumber(consumptionPct, 0),
                    })}
                  </Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_NUM]}
                >
                  <Text>
                    {t("statements.pdf.heating.basicShareHeader", {
                      percent: formatNumber(basicPct, 0),
                    })}
                  </Text>
                </View>
                <View
                  style={[styles.cellRight, styles.cellDivider, DIST_COL_TOTAL]}
                >
                  <Text>
                    {t("statements.pdf.heating.total")}
                    {footnoteMarkers(heatingIndices("total"))}
                  </Text>
                </View>
              </>
            )}
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
              isTarget: boolean;
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
                isTarget: true,
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
                isTarget: false,
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
                  <Text style={row.isTarget ? styles.bold : undefined}>
                    {row.label}
                  </Text>
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
                {distributionValueCells(
                  row.consumptionCostCents,
                  row.basicCostCents,
                  row.totalCents,
                  heatingMerged,
                  { boldTotal: row.isTarget },
                )}
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
                {distributionValueCells(
                  landlord.consumptionCostCents,
                  landlord.basicCostCents,
                  landlord.totalCents,
                  heatingMerged,
                  {},
                )}
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
            {distributionValueCells(
              detail.consumptionPortionCents,
              detail.basicPortionCents,
              heatingPotForDisplay,
              heatingMerged,
              { boldAll: true },
            )}
          </View>
        </View>
        {/* Nummerierte Spalten-Fußnoten in Spalten-Reihenfolge (Heizfläche,
            Bewertungspunkte, Summen-Anteil, Flächen-Fallback). Danach folgen
            freischwebende Hinweise ohne Spalten-Marker. */}
        {columnFootnotes.map((footnote) => (
          <Text key={footnote.key} style={styles.footnote}>
            {renderSuperscripts(
              `${toSuperscript(footnote.index)} ${t(footnote.label.key, footnote.label.params)}`,
            )}
          </Text>
        ))}
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
        {/* Hinweise aus der Berechnung, v. a. die rechtlich gebotene
            Kennzeichnung geschätzter Werte und der Ersatzverfahren.
            Datenqualitäts-Hinweise an den Vermieter bleiben in der
            Web-Oberfläche. */}
        {groupCalcWarnings((detail.warnings ?? []).filter(isTenantWarning)).map(
          (group) => (
            <Text key={calcWarningKey(group)} style={styles.footnote}>
              {formatCalcWarning(group)}
            </Text>
          ),
        )}
      </View>

      {hotWaterSection}
    </View>
  );
};
