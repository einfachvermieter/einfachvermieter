/**
 * Gemeinsames View-Model für die Heizkosten-Darstellung in Web-Karte und
 * PDF-Anlage (WYSIWYG-Pflicht: beide Renderer konsumieren dieselben
 * abgeleiteten Anzeigewerte, nur das Markup bleibt getrennt).
 */

import type { TranslateFn } from "@einfachvermieter/i18n";
import { formatEur, formatNumber } from "../format.js";
import type { HeatingDetail, Period } from "../types/index.js";
import {
  co2Tier,
  DEGREE_DAYS_PROMILLE_PER_MONTH,
  degreeDaysMonthlyBreakdown,
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

/**
 * Liste der bewohnten Monate mit ihrem festen Gradtagszahlen-Anteil,
 * z. B. „Jan 170 ‰, Feb 150 ‰". Nur Monate, in die die Mietzeit
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
            ? { key: "ui.common.emptyValue" }
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
            ? { key: "ui.common.emptyValue" }
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
 * enthaltene Steuern/Abgaben (soweit auf den Rechnungspositionen erfasst)
 * und die Summe der als Erfassungs-/Abrechnungsentgelt gekennzeichneten
 * Positionen. Leer, wenn nichts erfasst ist.
 */
export const billingInfoCostRows = (
  detail: Pick<
    HeatingDetail,
    "containedTaxesCents" | "meteringServiceCostCents"
  >,
): BillingInfoCostRow[] => {
  const rows: BillingInfoCostRow[] = [];

  if (detail.containedTaxesCents !== undefined) {
    rows.push({
      key: "containedTaxes",
      label: { key: "statements.pdf.billingInfo.containedTaxesLabel" },
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
