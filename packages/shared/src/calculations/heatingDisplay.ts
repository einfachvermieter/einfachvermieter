/**
 * Gemeinsames View-Model für die Heizkosten-Darstellung in Web-Karte und
 * PDF-Anlage (WYSIWYG-Pflicht: beide Renderer konsumieren dieselben
 * abgeleiteten Anzeigewerte, nur das Markup bleibt getrennt).
 */

import { formatNumber } from "../format.js";
import type { HeatingDetail, Period } from "../types/index.js";
import { co2Tier } from "./heating.js";

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
