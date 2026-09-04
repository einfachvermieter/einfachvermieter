/**
 * Gemeinsames View-Model für die Heizkosten-Darstellung in Web-Karte und
 * PDF-Anlage (WYSIWYG-Pflicht: beide Renderer konsumieren dieselben
 * abgeleiteten Anzeigewerte, nur das Markup bleibt getrennt).
 */

import { MONTH_KEYS, type TranslateFn } from "@einfachvermieter/i18n";
import { formatDate, formatEur, formatNumber } from "../format.js";
import type {
  EnergyComparison,
  HeatingDetail,
  Period,
} from "../types/index.js";
import {
  co2Tier,
  DEGREE_DAYS_PROMILLE_PER_MONTH,
  degreeDaysMonthlyBreakdown,
  sumDegreeDays,
} from "./heating.js";

export type LandlordShareRow = {
  consumptionCostCents: number;
  basicCostCents: number;
  totalCents: number;
};

/**
 * Vermieteranteil-Zeile der Verteilungstabellen (Heizung bzw. Warmwasser):
 * Grundkosten-Leerstand plus Verbrauch der Ziel-Wohnung außerhalb der
 * Mietzeit (Vor-/Nachmieter, Leerstand). null, wenn nichts auf den
 * Vermieter entfällt entfällt die Zeile.
 */
export const landlordShareRow = (detail: {
  landlordConsumptionCostCents?: number;
  landlordBasicCostCents?: number;
}): LandlordShareRow | null => {
  const consumptionCostCents = detail.landlordConsumptionCostCents ?? 0;
  const basicCostCents = detail.landlordBasicCostCents ?? 0;
  const totalCents = consumptionCostCents + basicCostCents;

  return totalCents > 0
    ? { consumptionCostCents, basicCostCents, totalCents }
    : null;
};

/**
 * Anzeige als "Bewertungspunkte" (/ 1.000) lohnt sich
 * bei sehr großen Roh-Summen
 */

export const HEATING_VALUATION_POINTS_THRESHOLD = 10_000_000;

/**
 * Pro Spalte entscheiden: sind alle Werte ganzzahlig, Nachkommastellen
 * komplett weglassen (Pro-Spalten- statt Pro-Zelle-Entscheidung).
 */
const allInteger = (values: number[]): boolean =>
  values.every((value) => Number.isInteger(value));

export type HeatingDisplay = {
  consumptionPct: number;
  basicPct: number;
  isHkv: boolean;
  distributionMethod: "consumption" | "heating_area";
  totalConsumption: number;
  totalArea: number;
  useValuationPoints: boolean;
  heatingPotForDisplay: number;
  isPartialPeriod: boolean;
  hotWaterConsumptionPct: number;
  hotWaterBasicPct: number;
  /**
   * Anteil des Heizungs- bzw. Warmwasser-Topfes an den gesamten Heizkosten
   * (§ 9 Abs. 2 HeizkostenV-Abspaltung), aus `hotWaterShareBps` abgeleitet und
   * damit auf 100 % komplementär. 0 bzw. 100, wenn kein Warmwasser abgespalten
   * ist; die Anzeige der Anteils-Fußnote wird dann ohnehin unterdrückt.
   */
  hotWaterSharePct: number;
  heatingSharePct: number;
  /**
   * Aggregierte Verbrauchseinheiten (Summary + Verteilung pro Wohnung). Bei
   * HKVs mit aktiven Bewertungspunkten skaliert auf (Wert / 1.000), sonst der
   * rohe kWh-/Einheiten-Wert. Reine Anzeige-Skalierung.
   */
  formatAggregatedConsumption: (value: number) => string;
};

/**
 * Berechnet die gemeinsamen Anzeigewerte der Heizkosten-Darstellung.
 * `tenantPeriod`/`statementPeriod` dienen nur der Erkennung unterjähriger
 * Nutzung (`isPartialPeriod`).
 */
export const prepareHeatingDisplay = (
  detail: HeatingDetail,
  tenantPeriod: Period,
  statementPeriod: Period,
): HeatingDisplay => {
  const consumptionPct = detail.consumptionShareBps / 100;
  const basicPct = 100 - consumptionPct;

  const isPartialPeriod =
    tenantPeriod.start !== statementPeriod.start ||
    tenantPeriod.end !== statementPeriod.end;
  const isHkv = detail.consumptionMethod === "heat_cost_allocator";
  const distributionMethod =
    detail.consumptionDistributionMethod ?? "consumption";
  const totalConsumption = detail.perUnit.reduce(
    (acc, row) => acc + row.consumptionKwh,
    0,
  );
  const totalArea = detail.perUnit.reduce((acc, row) => acc + row.areaSqm, 0);
  const useValuationPoints =
    isHkv && totalConsumption >= HEATING_VALUATION_POINTS_THRESHOLD;

  const aggregatedAllInteger = allInteger(
    detail.perUnit.map((unit) => unit.consumptionKwh),
  );

  let aggregatedConsumptionDigits = 2;
  if (useValuationPoints) {
    aggregatedConsumptionDigits = 3;
  } else if (aggregatedAllInteger) {
    aggregatedConsumptionDigits = 0;
  }

  const formatAggregatedConsumption = (value: number): string => {
    if (!isHkv) {
      return formatNumber(value, aggregatedConsumptionDigits);
    }

    return useValuationPoints
      ? formatNumber(value / 1000, 3)
      : formatNumber(value, aggregatedConsumptionDigits);
  };

  const hw = detail.hotWaterDetail;
  const heatingPotForDisplay = hw
    ? (detail.heatingPotCents ??
      detail.totalHeatingCostsCents - hw.hotWaterPotCents)
    : detail.totalHeatingCostsCents;
  const hotWaterConsumptionPct = hw ? hw.consumptionShareBps / 100 : 0;
  const hotWaterBasicPct = 100 - hotWaterConsumptionPct;
  const hotWaterSharePct = hw ? hw.hotWaterShareBps / 100 : 0;
  const heatingSharePct = 100 - hotWaterSharePct;

  return {
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
  };
};

/**
 * Nachkommastellen der drei Zähler-Spalten (Stand-Delta, KGesamt, bewerteter
 * Wert): pro Spalte 0, wenn alle Werte ganzzahlig sind, sonst die volle Genauigkeit.
 */
export const perMeterDisplayDigits = (
  perMeter: NonNullable<HeatingDetail["perMeter"]>,
): {
  consumptionRawDigits: number;
  kTotalDigits: number;
  consumptionWeightedDigits: number;
} => {
  const kTotalValues = perMeter
    .map((row) => row.kTotal)
    .filter((value): value is number => value !== null && value !== undefined);

  return {
    consumptionRawDigits: allInteger(perMeter.map((row) => row.consumptionRaw))
      ? 0
      : 2,
    kTotalDigits: allInteger(kTotalValues) ? 0 : 3,
    consumptionWeightedDigits: allInteger(
      perMeter.map((row) => row.consumptionWeighted),
    )
      ? 0
      : 2,
  };
};

export type HeatingLabelDescriptor = {
  key: string;
  params?: Record<string, string>;
};

export type HeatingColumnFootnote = {
  key: "heatingArea" | "valuationPoints" | "totalShare" | "areaFallback";
  column: "heatingArea" | "consumption" | "total";
  /**
   * 1..N in Spalten-Reihenfolge; liefert den hochgestellten Marker sowohl am
   * Spaltenkopf als auch vor dem Fußnotentext. Mehrere Fußnoten dürfen auf
   * dieselbe Spalte zeigen (z. B. Summe: Anteil + Flächen-Fallback).
   */
  index: number;
  label: HeatingLabelDescriptor;
};

/**
 * Nummerierte Spalten-Fußnoten der Heizungs-Verteilungstabelle in Spalten-
 * Reihenfolge (Heizfläche -> Verbrauch/Bewertungspunkte -> Summe). Nur die
 * tatsächlich zutreffenden Einträge. Gemeinsame Quelle für Web-Karte und
 * PDF-Anlage, damit beide dieselbe Nummerierung zeigen (WYSIWYG). Die
 * Summen-Fußnote (Anteil an den Heizkosten) erscheint nur, wenn Warmwasser
 * abgespalten ist; die Flächen-Fallback-Fußnote nur, wenn mangels Verbrauchs-
 * messern ersatzweise nach Fläche verteilt wurde (dann fasst die Tabelle die
 * Verbrauchs- und Grundkostenspalte zu einer "100 % nach Fläche"-Spalte
 * zusammen, an der beide Marker hängen).
 */
export const heatingColumnFootnotes = (
  detail: HeatingDetail,
  useValuationPoints: boolean,
  heatingSharePct: number,
): HeatingColumnFootnote[] => {
  const notes: Omit<HeatingColumnFootnote, "index">[] = [];
  if (detail.heatingAreaDiffersFromLivingArea) {
    notes.push({
      key: "heatingArea",
      column: "heatingArea",
      label: { key: "statements.pdf.heating.heatingAreaNote" },
    });
  }
  if (useValuationPoints) {
    notes.push({
      key: "valuationPoints",
      column: "consumption",
      label: { key: "statements.pdf.heating.valuationPointsNote" },
    });
  }
  if (detail.hotWaterDetail) {
    notes.push({
      key: "totalShare",
      column: "total",
      label: {
        key: "statements.pdf.heating.totalShareNote",
        params: { percent: formatNumber(heatingSharePct, 1) },
      },
    });
  }
  if (
    (detail.consumptionDistributionMethod ?? "consumption") === "heating_area"
  ) {
    notes.push({
      key: "areaFallback",
      column: "total",
      label: {
        key: "statements.pdf.heating.consumptionDistributionHeatingArea",
      },
    });
  }
  return notes.map((note, idx) => ({ ...note, index: idx + 1 }));
};

/**
 * Spalten-Fußnoten der Warmwasser-Verteilungstabelle: der Anteil an den
 * Heizkosten sowie, falls mangels Warmwasserzählern nach Fläche verteilt,
 * die Flächen-Fallback-Note. Beide hängen an der Summen- bzw. (im Fallback)
 * "100 % nach Fläche"-Spalte. Eigene Nummerierung je Tabelle (1..N).
 */
export const hotWaterColumnFootnotes = (
  hotWater: NonNullable<HeatingDetail["hotWaterDetail"]>,
  hotWaterSharePct: number,
): HeatingColumnFootnote[] => {
  const notes: Omit<HeatingColumnFootnote, "index">[] = [
    {
      key: "totalShare",
      column: "total",
      label: {
        key: "statements.pdf.heating.totalShareNote",
        params: { percent: formatNumber(hotWaterSharePct, 1) },
      },
    },
  ];
  if (hotWater.consumptionDistributionMethod === "heating_area") {
    notes.push({
      key: "areaFallback",
      column: "total",
      label: { key: "statements.pdf.heating.hotWater.consumptionFallbackArea" },
    });
  }
  return notes.map((note, idx) => ({ ...note, index: idx + 1 }));
};

/**
 * Auf den Mieter entfallender CO2-Kostenanteil in Cent (§ 7 Abs. 3
 * CO2KostAufG verlangt ihn in der Abrechnung)
 */
export const co2TenantShareCents = (
  detail: HeatingDetail,
  ownTotalCents: number,
): number | null => {
  const co2 = detail.co2Detail;
  if (!co2 || detail.totalHeatingCostsCents <= 0) {
    return null;
  }

  const tenantSideCo2Cents = co2.totalCostCents - co2.landlordDeductionCents;

  return Math.round(
    tenantSideCo2Cents * (ownTotalCents / detail.totalHeatingCostsCents),
  );
};

/**
 * Liste der bewohnten Monate mit ihrem festen Gradtagszahlen-Anteil,
 * z. B. "Jan 170 ‰, Feb 150 ‰". Nur Monate, in die die Mietzeit
 * (teilweise) fällt.
 */
const residentMonthsPromille = (
  period: Period,
  translate: TranslateFn,
): string =>
  degreeDaysMonthlyBreakdown(period)
    .filter((row) => row.calendarDays > 0)
    .map(
      (row) =>
        `${translate(`common.monthsShort.${MONTH_KEYS[row.monthIndex]}`)}\u00A0${formatNumber(
          DEGREE_DAYS_PROMILLE_PER_MONTH[row.monthIndex] ?? 0,
          0,
        )}\u00A0‰`,
    )
    .join(", ");

/**
 * Hinweis zur zeitanteiligen Verteilung bei unterjähriger Nutzung, gemeinsame
 * Quelle für Web-Karte und PDF-Anlage. Die Vorlage hängt an zwei Achsen:
 *
 * - Liegt eine Zwischenablesung vor, ist der Verbrauch über die Zählerstände
 *   exakt abgegrenzt und nur die Grundkosten werden zeitanteilig verteilt.
 *   Ohne erfassten Verbrauch (`heating_area`) betrifft es die gesamten
 *   Heizkosten.
 * - `degree_days` gewichtet nach Gradtagszahlen (mit Auflistung der bewohnten
 *   Monatsanteile), `linear` nach Nutzungstagen.
 */
export const prorationNote = (
  detail: HeatingDetail,
  tenantPeriod: Period,
  translate: TranslateFn,
): string => {
  const distributesAll =
    (detail.consumptionDistributionMethod ?? "consumption") === "heating_area";

  if (detail.prorationMethod === "degree_days") {
    const months = residentMonthsPromille(tenantPeriod, translate);
    return distributesAll
      ? translate("statements.pdf.heating.prorationNoteDegreeDaysAll", {
          months,
        })
      : translate("statements.pdf.heating.prorationNoteDegreeDaysBase", {
          months,
        });
  }

  return distributesAll
    ? translate("statements.pdf.heating.prorationNoteLinearAll")
    : translate("statements.pdf.heating.prorationNoteLinearBase");
};

/**
 * Spaltenkopf der Verbrauchsspalte: kWh bei Wärmemengenzählern, bei
 * Heizkostenverteilern Anzeigewerte bzw. Bewertungspunkte.
 */
export const consumptionUnitLabel = (
  method: HeatingDetail["consumptionMethod"],
  useValuationPoints: boolean,
): HeatingLabelDescriptor => {
  if (method !== "heat_cost_allocator") {
    return { key: "statements.pdf.heating.consumptionKwh" };
  }
  return {
    key: useValuationPoints
      ? "statements.pdf.heating.consumptionUnits"
      : "statements.pdf.heating.consumptionUnitsRaw",
  };
};

export type HotWaterFactRow = {
  key: "method" | "totalHeatEnergy" | "hotWaterHeat" | "correctionFactor";
  label: HeatingLabelDescriptor;
  value: HeatingLabelDescriptor;
};

/**
 * Nachvollziehbarkeit der Warmwasser-Abspaltung (§ 9 Abs. 2 HeizkostenV):
 * Ermittlungsweg, Gesamt-Wärmemenge Q_gesamt, Warmwasser-Wärmemenge Q_WW und
 * ggf. Korrekturfaktor nach Satz 5. Gemeinsame Quelle.
 */
export const hotWaterFactRows = (
  hotWater: NonNullable<HeatingDetail["hotWaterDetail"]>,
): HotWaterFactRow[] => {
  const rows: HotWaterFactRow[] = [
    {
      key: "method",
      label: { key: "statements.pdf.heating.hotWater.methodLabel" },
      value: {
        key: `statements.pdf.heating.hotWater.method.${hotWater.method}`,
      },
    },
    {
      key: "totalHeatEnergy",
      label: { key: "statements.pdf.heating.hotWater.totalHeatEnergyLabel" },
      value: {
        key: "statements.pdf.heating.hotWater.kwhValue",
        params: { value: formatNumber(hotWater.totalHeatEnergyKwh, 0) },
      },
    },
    {
      key: "hotWaterHeat",
      label: { key: "statements.pdf.heating.hotWater.hotWaterHeatLabel" },
      value: {
        key: "statements.pdf.heating.hotWater.kwhValue",
        params: { value: formatNumber(hotWater.hotWaterHeatKwh, 0) },
      },
    },
  ];

  if (hotWater.correctionFactor !== undefined) {
    rows.push({
      key: "correctionFactor",
      label: { key: "statements.pdf.heating.hotWater.correctionFactorLabel" },
      value: {
        key: "statements.pdf.heating.hotWater.correctionFactorValue",
        params: { value: formatNumber(hotWater.correctionFactor, 2) },
      },
    });
  }

  return rows;
};

/**
 * Ob die Heizkosten-Anlage mit dem Rechenweg gedruckt wird: bei interner
 * Abrechnung immer; bei externer Abrechnung nur, wenn die App tatsächlich
 * etwas gerechnet oder aufgeschlüsselt hat.
 */
export const hasHeatingBreakdown = (
  detail: Pick<
    HeatingDetail,
    "mode" | "basicPortionCents" | "consumptionPortionCents"
  >,
  tenantPeriod: Period,
  statementPeriod: Period,
): boolean => {
  if (detail.mode === "internal") {
    return true;
  }

  const isPartialPeriod =
    tenantPeriod.start !== statementPeriod.start ||
    tenantPeriod.end !== statementPeriod.end;

  return (
    isPartialPeriod ||
    detail.basicPortionCents > 0 ||
    detail.consumptionPortionCents > 0
  );
};

export type BillingInfoRow = {
  key:
    | "energySource"
    | "energyShare"
    | "districtHeatEmissions"
    | "districtHeatFactor";
  label: HeatingLabelDescriptor;
  value: HeatingLabelDescriptor;
};

/**
 * Zeilen des Energieträger-Blocks der Abrechnungsinformationen nach
 * § 6a Abs. 3 HeizkostenV. Die App kennt genau einen Energieträger je
 * Heizkonfiguration, der Anteil ist daher immer 100 %.
 * Bei Fernwärme kommen Treibhausgasemissionen und Primärenergiefaktor
 * des Netzes dazu.
 */
export const billingInfoRows = (
  detail: Pick<HeatingDetail, "fuelType" | "districtHeatInfo">,
): BillingInfoRow[] => {
  const rows: BillingInfoRow[] = [];

  if (detail.fuelType === undefined) {
    return rows;
  }

  rows.push(
    {
      key: "energySource",
      label: { key: "statements.pdf.billingInfo.energySourceLabel" },
      value: { key: `ui.heating.fuelTypes.${detail.fuelType}` },
    },
    {
      key: "energyShare",
      label: { key: "statements.pdf.billingInfo.energyShareLabel" },
      value: { key: "statements.pdf.billingInfo.energyShareFull" },
    },
  );

  const districtHeat = detail.districtHeatInfo;
  if (districtHeat) {
    rows.push(
      {
        key: "districtHeatEmissions",
        label: { key: "statements.pdf.billingInfo.districtHeatEmissionsLabel" },
        value:
          districtHeat.emissionsKgPerYear === null
            ? { key: "statements.pdf.billingInfo.districtHeatValueMissing" }
            : {
                key: "statements.pdf.billingInfo.districtHeatEmissionsValue",
                params: {
                  value: formatNumber(districtHeat.emissionsKgPerYear, 0),
                },
              },
      },
      {
        key: "districtHeatFactor",
        label: { key: "statements.pdf.billingInfo.districtHeatFactorLabel" },
        value:
          districtHeat.primaryEnergyFactor === null
            ? { key: "statements.pdf.billingInfo.districtHeatValueMissing" }
            : {
                key: "statements.pdf.billingInfo.districtHeatFactorValue",
                params: {
                  value: formatNumber(districtHeat.primaryEnergyFactor, 2),
                },
              },
      },
    );
  }

  return rows;
};

export type BillingInfoCostRow = {
  key: "containedTaxes" | "meteringService";
  label: HeatingLabelDescriptor;
  value: HeatingLabelDescriptor;
};

/**
 * Zeilen des Blocks "Steuern, Abgaben und Entgelte" der Abrechnungs-
 * informationen nach § 6a Abs. 3 Nr. 1b/1c HeizkostenV: in den Heizkosten
 * enthaltene Steuern/Abgaben (soweit auf den Rechnungspositionen erfasst,
 * die erfassten Arten stehen im Label) und die Summe der als Erfassungs-/
 * Abrechnungsentgelt gekennzeichneten Positionen. Leer, wenn nichts
 * erfasst ist.
 */
export const billingInfoCostRows = (
  detail: Pick<
    HeatingDetail,
    "containedTaxesCents" | "containedTaxKinds" | "meteringServiceCostCents"
  >,
  translate: TranslateFn,
): BillingInfoCostRow[] => {
  const rows: BillingInfoCostRow[] = [];
  const kinds = detail.containedTaxKinds ?? [];

  if (detail.containedTaxesCents !== undefined) {
    rows.push({
      key: "containedTaxes",
      // Die erfassten Arten benennen die Summe naeher und gehoeren deshalb
      // ins Label - die Wertspalte bleibt eine reine Betragsspalte.
      label:
        kinds.length > 0
          ? {
              key: "statements.pdf.billingInfo.containedTaxesLabelWithKinds",
              params: {
                kinds: kinds
                  .map((kind) => translate(`ui.costs.taxKinds.${kind}`))
                  .join(", "),
              },
            }
          : { key: "statements.pdf.billingInfo.containedTaxesLabel" },
      value: {
        key: "statements.pdf.billingInfo.containedTaxesValue",
        params: { value: formatEur(detail.containedTaxesCents) },
      },
    });
  }

  if (detail.meteringServiceCostCents !== undefined) {
    rows.push({
      key: "meteringService",
      label: { key: "statements.pdf.billingInfo.meteringServiceLabel" },
      value: {
        key: "statements.pdf.billingInfo.meteringServiceValue",
        params: { value: formatEur(detail.meteringServiceCostCents) },
      },
    });
  }

  return rows;
};

export type AverageUserComparisonRow = {
  key: "ownConsumption" | "averageConsumption";
  label: HeatingLabelDescriptor;
  value: HeatingLabelDescriptor;
};

/**
 * Vergleich mit dem Durchschnittsnutzer (§ 6a Abs. 3 Nr. 4 HeizkostenV):
 * eigener Heizverbrauch je m2 neben dem Gebäudedurchschnitt derselben
 * Abrechnungsperiode. Alle Werte stammen aus dem eingefrorenen
 * `perUnit`-Snapshot, die Ableitung ist damit reproduzierbar.
 *
 * Bei unterjähriger Nutzung deckt der eigene Verbrauch nur die Mietzeit ab.
 * Er wird dann über die Gradtagszahlen auf den vollen Abrechnungszeitraum
 * hochgerechnet (Praxis der Messdienste) und geht auch so in den
 * Gebäudedurchschnitt ein, damit beide Seiten denselben Zeitraum abbilden.
 * `isExtrapolated` sagt der Anzeige, dass die Fußnote dazu nötig ist.
 *
 * `null`, wenn kein Vergleich möglich ist: externer Modus, Flächen-Fallback
 * ohne gemessenen Verbrauch, fehlende Flächen.
 */
export const averageUserComparison = (
  detail: Pick<
    HeatingDetail,
    "mode" | "consumptionMethod" | "consumptionDistributionMethod" | "perUnit"
  >,
  targetUnitId: string,
  tenantPeriod: Period,
  statementPeriod: Period,
): { rows: AverageUserComparisonRow[]; isExtrapolated: boolean } | null => {
  if (
    detail.mode === "external" ||
    (detail.consumptionDistributionMethod ?? "consumption") === "heating_area"
  ) {
    return null;
  }

  const ownRow = detail.perUnit.find((row) => row.unitId === targetUnitId);
  const totalArea = detail.perUnit.reduce((acc, row) => acc + row.areaSqm, 0);

  // Bei einer einzigen Wohnung waere der "Durchschnitt" der eigene Verbrauch.
  if (
    !ownRow ||
    ownRow.areaSqm <= 0 ||
    totalArea <= 0 ||
    detail.perUnit.length < 2
  ) {
    return null;
  }

  const isExtrapolated =
    tenantPeriod.start !== statementPeriod.start ||
    tenantPeriod.end !== statementPeriod.end;
  const tenantDegreeDays = sumDegreeDays(tenantPeriod);

  if (isExtrapolated && tenantDegreeDays <= 0) {
    return null;
  }

  const ownConsumption = isExtrapolated
    ? (ownRow.consumptionKwh / tenantDegreeDays) *
      sumDegreeDays(statementPeriod)
    : ownRow.consumptionKwh;
  // Die anderen Wohnungen stehen mit dem vollen Zeitraum im Snapshot, die
  // Ziel-Wohnung nur mit der Mietzeit, für den Durchschnitt zählt deshalb
  // ihr hochgerechneter Wert.
  const totalConsumption = detail.perUnit.reduce(
    (acc, row) =>
      acc + (row.unitId === targetUnitId ? ownConsumption : row.consumptionKwh),
    0,
  );

  const isHkv = detail.consumptionMethod === "heat_cost_allocator";
  const useValuationPoints =
    isHkv && totalConsumption >= HEATING_VALUATION_POINTS_THRESHOLD;

  let valueKey = "statements.pdf.billingInfo.comparisonValueKwh";
  if (isHkv) {
    valueKey = useValuationPoints
      ? "statements.pdf.billingInfo.comparisonValuePoints"
      : "statements.pdf.billingInfo.comparisonValueUnits";
  }

  const perSqm = (
    consumption: number,
    areaSqm: number,
  ): HeatingLabelDescriptor => {
    const raw = consumption / areaSqm;
    return {
      key: valueKey,
      params: {
        value: formatNumber(useValuationPoints ? raw / 1000 : raw, 1),
      },
    };
  };

  return {
    rows: [
      {
        key: "ownConsumption",
        label: { key: "statements.pdf.billingInfo.comparisonOwnLabel" },
        value: perSqm(ownConsumption, ownRow.areaSqm),
      },
      {
        key: "averageConsumption",
        label: {
          key: "statements.pdf.billingInfo.comparisonAverageLabel",
          params: { count: String(detail.perUnit.length) },
        },
        value: perSqm(totalConsumption, totalArea),
      },
    ],
    isExtrapolated,
  };
};

export type EnergyComparisonBar = {
  key: "current" | "previous";
  label: HeatingLabelDescriptor;
  value: HeatingLabelDescriptor;
  widthPct: number;
};

export type EnergyComparisonDisplay = {
  /**
   * Leer, wenn die Vorperiode fehlt. Dann zeigt der Anhang die
   * Hinweiszeile statt der Grafik
   */
  bars: EnergyComparisonBar[];
  previousMissing: boolean;
  notes: HeatingLabelDescriptor[];
};

/**
 * Anzeigewerte des Vorperiodenvergleichs aus der eingefrorenen
 * Snapshot-Sektion `energyComparison`. Gemeinsame Quelle für die
 * Balkengrafik in PDF-Anhang und Web-Karte (WYSIWYG). Bei
 * HKV-Werten oberhalb der Bewertungspunkte-Schwelle skaliert die Anzeige
 * beide Balkenwerte einheitlich auf Punkte (/ 1.000).
 */
export const energyComparisonDisplay = (
  comparison: EnergyComparison,
): EnergyComparisonDisplay => {
  if (!comparison.previous) {
    return { bars: [], previousMissing: true, notes: [] };
  }

  const currentValue = comparison.current.normalizedConsumption;
  const previousValue = comparison.previous.normalizedConsumption;
  const maxValue = Math.max(currentValue, previousValue);

  const isHkv = comparison.consumptionUnit === "hkv_units";
  const useValuationPoints =
    isHkv && maxValue >= HEATING_VALUATION_POINTS_THRESHOLD;

  let valueKey = "statements.pdf.billingInfo.comparisonPrevValueKwh";
  if (isHkv) {
    valueKey = useValuationPoints
      ? "statements.pdf.billingInfo.comparisonPrevValuePoints"
      : "statements.pdf.billingInfo.comparisonPrevValueUnits";
  }

  /**
   * Deckt der Zeitraum kein volles Jahr ab, ist der Wert über die
   * Gradtagszahlen hochgerechnet - das gehört sichtbar ans Label, sonst
   * liest sich der Balken wie ein gemessener Wert.
   */
  const isExtrapolated = (period: Period): boolean =>
    Math.abs(sumDegreeDays(period) - 1000) > 0.01;

  const bar = (
    key: "current" | "previous",
    labelKey: string,
    period: Period,
    value: number,
  ): EnergyComparisonBar => ({
    key,
    label: {
      key: labelKey,
      params: { start: formatDate(period.start), end: formatDate(period.end) },
    },
    value: {
      key: valueKey,
      params: {
        value: formatNumber(useValuationPoints ? value / 1000 : value, 0),
      },
    },
    widthPct: maxValue > 0 ? (value / maxValue) * 100 : 0,
  });

  // Klimafaktoren stehen entweder auf beiden Seiten oder gar nicht;
  // in Fußnote steht, welcher Fall vorliegt. DWD-Quellenvermerk entfällt,
  // sobald ein Faktor manuell erfasst ist.
  const currentClimateFactor = comparison.current.climateFactor;
  const previousClimateFactor = comparison.previous.climateFactor;
  const anyManual =
    comparison.current.climateFactorIsManual === true ||
    comparison.previous.climateFactorIsManual === true;
  // Rechenweg offenlegen (Praxis der Messdienste). Nur ohne Warmwasser-
  // Anteil, sonst ginge die Gleichung nicht auf: Warmwasser wird
  // unbereinigt addiert, nicht mitmultipliziert.
  const showsCalculation =
    currentClimateFactor !== undefined &&
    previousClimateFactor !== undefined &&
    !comparison.includesHotWater;

  /**
   * Die Faktoren stehen nur dann im Witterungs-Satz, wenn sie nicht
   * ohnehin gleich darunter im Rechenweg auftauchen.
   */
  const weatherNoteKey = (): string => {
    if (anyManual) {
      return showsCalculation
        ? "statements.pdf.billingInfo.comparisonPrevWeatherNoteShortManual"
        : "statements.pdf.billingInfo.comparisonPrevWeatherNoteManual";
    }
    return showsCalculation
      ? "statements.pdf.billingInfo.comparisonPrevWeatherNoteShort"
      : "statements.pdf.billingInfo.comparisonPrevWeatherNote";
  };

  const notes: HeatingLabelDescriptor[] = [
    currentClimateFactor !== undefined && previousClimateFactor !== undefined
      ? {
          key: weatherNoteKey(),
          ...(showsCalculation
            ? {}
            : {
                params: {
                  current: formatNumber(currentClimateFactor, 2),
                  previous: formatNumber(previousClimateFactor, 2),
                },
              }),
        }
      : { key: "statements.pdf.billingInfo.comparisonPrevNoAdjustmentNote" },
  ];
  if (showsCalculation && currentClimateFactor && previousClimateFactor) {
    const scale = (value: number, factor: number): string =>
      formatNumber(
        useValuationPoints ? value / factor / 1000 : value / factor,
        0,
      );
    notes.push({
      key: "statements.pdf.billingInfo.comparisonPrevCalculationNote",
      params: {
        currentBase: scale(currentValue, currentClimateFactor),
        currentFactor: formatNumber(currentClimateFactor, 2),
        currentResult: formatNumber(
          useValuationPoints ? currentValue / 1000 : currentValue,
          0,
        ),
        previousBase: scale(previousValue, previousClimateFactor),
        previousFactor: formatNumber(previousClimateFactor, 2),
        previousResult: formatNumber(
          useValuationPoints ? previousValue / 1000 : previousValue,
          0,
        ),
      },
    });
  }

  // Hochrechnung als Fußnote statt am Balken-Label: dort würde der Zusatz
  // beide Labels zweizeilig machen und den Anhang über die Seite treiben.
  if (
    isExtrapolated(comparison.current.period) ||
    isExtrapolated(comparison.previous.period)
  ) {
    notes.push({
      key: "statements.pdf.billingInfo.comparisonPrevExtrapolatedNote",
    });
  }

  if (comparison.includesHotWater) {
    notes.push({
      key: "statements.pdf.billingInfo.comparisonPrevHotWaterNote",
    });
  }

  return {
    bars: [
      bar(
        "current",
        "statements.pdf.billingInfo.comparisonPrevCurrentLabel",
        comparison.current.period,
        currentValue,
      ),
      bar(
        "previous",
        "statements.pdf.billingInfo.comparisonPrevPreviousLabel",
        comparison.previous.period,
        previousValue,
      ),
    ],
    previousMissing: false,
    notes,
  };
};

/**
 * CO2KostAufG-Einstufungs-Label: Stufe des Gebäude-Ausstoßes als eine der drei
 * Bereichsformen (unterste/mittlere/oberste Stufe).
 */
export const co2TierLabel = (
  emissionsKgPerSqmYear: number,
): HeatingLabelDescriptor => {
  const tier = co2Tier(emissionsKgPerSqmYear);
  if (!Number.isFinite(tier.maxExclusive)) {
    return {
      key: "statements.pdf.heating.co2.tierAbove",
      params: { min: formatNumber(tier.minInclusive, 0) },
    };
  }

  if (tier.minInclusive === 0) {
    return {
      key: "statements.pdf.heating.co2.tierBelow",
      params: { max: formatNumber(tier.maxExclusive, 0) },
    };
  }

  return {
    key: "statements.pdf.heating.co2.tierRange",
    params: {
      min: formatNumber(tier.minInclusive, 0),
      max: formatNumber(tier.maxExclusive, 0),
    },
  };
};
