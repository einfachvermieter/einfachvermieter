/**
 * Vorperiodenvergleich des witterungsbereinigten Energieverbrauchs nach
 * § 6a Abs. 3 Nr. 5 HeizkostenV. Rein: alle Eingaben stammen aus dem
 * aktuellen Berechnungslauf bzw. dem Snapshot des Vorperioden-Statements.
 */

import type {
  EnergyComparison,
  HeatingDetail,
  Period,
} from "../types/index.js";
import { sumDegreeDays } from "./heating.js";
import { daysBetween, daysInYear } from "./period.js";

export type EnergyComparisonPeriodInput = {
  detail: Pick<
    HeatingDetail,
    | "mode"
    | "consumptionMethod"
    | "consumptionDistributionMethod"
    | "perUnit"
    | "hotWaterDetail"
  >;
  /**
   * Nutzungszeitraum des Mieters, den der Verbrauch der Ziel-Wohnung
   * abdeckt (Zwischenablesungs-Logik der Heizkostenberechnung).
   */
  tenantPeriod: Period;
  /**
   * Klimafaktor des Abrechnungszeitraums (DWD je Postleitzahl bzw.
   * manuell erfasst). null/undefined, wenn keiner verfügbar ist,
   * bleibt der Heizanteil dann unbereinigt.
   */
  climateFactor?: number | null;
  /**
   * Der Faktor stammt aus manueller Erfassung statt vom DWD.
   */
  climateFactorIsManual?: boolean;
};

type PeriodEnergy = {
  unit: "kwh" | "hkv_units";
  /**
   * Heizverbrauch, über die Gradtagszahlen der Periode witterungsbereinigt
   * und auf ein Normjahr (1.000 ‰) hochgerechnet.
   */
  normalizedHeat: number;
  /**
   * Warmwasser-Energieanteil der Wohnung in kWh, tagesanteilig auf ein
   * volles Jahr hochgerechnet (Witterungsbereinigung greift hier nicht).
   * null, wenn nicht ermittelbar oder die Heiz-Einheit keine kWh ist.
   */
  normalizedHotWaterKwh: number | null;
};

/**
 * Verbrauchswert einer Abrechnungsperiode für den Vergleich. null, wenn die
 * Periode keinen gemessenen Verbrauch der Ziel-Wohnung hat.
 */
const periodEnergy = (
  input: EnergyComparisonPeriodInput,
  targetUnitId: string,
): PeriodEnergy | null => {
  const { detail, tenantPeriod } = input;
  if (
    detail.mode === "external" ||
    (detail.consumptionDistributionMethod ?? "consumption") === "heating_area"
  ) {
    return null;
  }

  const ownRow = detail.perUnit.find((row) => row.unitId === targetUnitId);
  const degreeDayPromille = sumDegreeDays(tenantPeriod);
  if (!ownRow || degreeDayPromille <= 0) {
    return null;
  }

  const unit =
    detail.consumptionMethod === "heat_cost_allocator" ? "hkv_units" : "kwh";
  const normalizedHeat = (ownRow.consumptionKwh / degreeDayPromille) * 1000;

  let normalizedHotWaterKwh: number | null = null;
  const hotWater = detail.hotWaterDetail;
  if (unit === "kwh" && hotWater) {
    const ownHotWater = hotWater.perUnit.find(
      (row) => row.unitId === targetUnitId,
    );
    // Gesamtvolumen bevorzugt aus der Schätzformel (enthält den
    // Vermieteranteil), sonst Summe der Wohnungswerte.
    const totalM3 =
      hotWater.hotWaterVolumeM3 ??
      hotWater.perUnit.reduce((acc, row) => acc + row.hotWaterM3, 0);
    const days = daysBetween(tenantPeriod.start, tenantPeriod.end);

    if (
      ownHotWater &&
      ownHotWater.hotWaterM3 > 0 &&
      totalM3 > 0 &&
      hotWater.hotWaterHeatKwh > 0 &&
      days > 0
    ) {
      const hotWaterKwh =
        hotWater.hotWaterHeatKwh * (ownHotWater.hotWaterM3 / totalM3);
      normalizedHotWaterKwh =
        (hotWaterKwh / days) * daysInYear(tenantPeriod.start);
    }
  }

  return { unit, normalizedHeat, normalizedHotWaterKwh };
};

/**
 * Baut die Snapshot-Sektion `energyComparison`. undefined, wenn die aktuelle
 * Periode keinen vergleichbaren Verbrauch hat (dann entfällt der Block im
 * § 6a-Anhang). Die Vorperiode fällt still weg, wenn ihr Verbrauch fehlt
 * oder in einer anderen Einheit gemessen wurde; Warmwasser ist nur
 * enthalten, wenn es sich für beide Perioden ermitteln lässt. Klimafaktoren
 * werden nur angewendet, wenn sie für beide Vergleichsseiten vorliegen.
 */
export const buildEnergyComparison = (
  targetUnitId: string,
  current: EnergyComparisonPeriodInput,
  previous?: EnergyComparisonPeriodInput,
): EnergyComparison | undefined => {
  const currentEnergy = periodEnergy(current, targetUnitId);
  if (!currentEnergy) {
    return;
  }

  let previousEnergy = previous ? periodEnergy(previous, targetUnitId) : null;
  if (previousEnergy && previousEnergy.unit !== currentEnergy.unit) {
    previousEnergy = null;
  }

  const includesHotWater =
    currentEnergy.normalizedHotWaterKwh !== null &&
    (previousEnergy === null || previousEnergy.normalizedHotWaterKwh !== null);

  const currentFactor = current.climateFactor ?? null;
  const previousFactor = previousEnergy
    ? (previous?.climateFactor ?? null)
    : null;
  const applyFactors = previousEnergy
    ? currentFactor !== null && previousFactor !== null
    : currentFactor !== null;

  const totalOf = (energy: PeriodEnergy, factor: number | null): number => {
    const heat =
      applyFactors && factor !== null
        ? energy.normalizedHeat * factor
        : energy.normalizedHeat;
    return includesHotWater ? heat + (energy.normalizedHotWaterKwh ?? 0) : heat;
  };

  return {
    consumptionUnit: currentEnergy.unit,
    includesHotWater,
    current: {
      period: current.tenantPeriod,
      normalizedConsumption: totalOf(currentEnergy, currentFactor),
      ...(applyFactors && currentFactor !== null
        ? {
            climateFactor: currentFactor,
            ...(current.climateFactorIsManual
              ? { climateFactorIsManual: true }
              : {}),
          }
        : {}),
    },
    ...(previousEnergy && previous
      ? {
          previous: {
            period: previous.tenantPeriod,
            normalizedConsumption: totalOf(previousEnergy, previousFactor),
            ...(applyFactors && previousFactor !== null
              ? {
                  climateFactor: previousFactor,
                  ...(previous.climateFactorIsManual
                    ? { climateFactorIsManual: true }
                    : {}),
                }
              : {}),
          },
        }
      : {}),
  };
};
