import type { UnitInfo, WaterDetail } from "../types/index.js";
import { CalculationError, type CalcWarning } from "./diagnostics.js";
import { computeMeterConsumption, type MeterBundle } from "./virtualMeter.js";

/**
 * Dedupliziert eine Warnungsliste (z. B. wenn derselbe Zähler einmal
 * über `consumptionBetween` und einmal rekursiv via `computeMeterConsumption`
 * gemeldet wird). Reihenfolge bleibt erhalten.
 */
const dedupe = (warnings: CalcWarning[]): CalcWarning[] => {
  const seen = new Set<string>();
  const out: CalcWarning[] = [];

  for (const warning of warnings) {
    const key = `${warning.code}:${JSON.stringify(warning.params ?? {})}`;

    if (!seen.has(key)) {
      seen.add(key);
      out.push(warning);
    }
  }

  return out;
};

/**
 * Bundle eines Wasserzählers: Metadaten, Stände und bei virtuellen
 * Differenzzählern die Differenz-Konfiguration.
 */
export type WaterMeterBundle = MeterBundle;

type WaterCalculationInput = {
  units: UnitInfo[];

  /**
   * Alle Wasserzähler des Gebäudes:
   * - role="main":                Hauptzähler (Gesamtverbrauch)
   * - role="unit":                Wohnungszähler
   * - role="common":              Allgemeinzähler (z. B. Gartenwasser)
   * - role="virtual_difference":  Differenzzähler - Verbrauch wird aus
   *                               `differenceConfig` (Basis − Subtraktionen)
   *                               berechnet.
   */
  waterMeters: WaterMeterBundle[];
  periodStart: string;
  periodEnd: string;
};

/**
 * Berechnet den Wasserverbrauch pro Wohnung. Wohnungen ohne eigenen
 * physischen Zähler werden über einen explizit konfigurierten
 * Differenzzähler (`role = "virtual_difference"`) abgebildet.
 *
 * Beispiel:
 *   Haupt (main) − Wohnung A (unit) − Waschmaschine A (common)
 *   = Wohnung B (virtual_difference)
 *
 * Common-Zähler (z. B. Gartenwasser) sind parallel und
 * werden der Wohnung zugeordnet, in deren Zuständigkeit sie liegen
 * (`meter.unitId`). Sub-Zähler (`role="sub"`) sitzen hinter dem
 * Wohnungszähler und werden hier nicht separat addiert.
 */
export const calculateWater = (input: WaterCalculationInput): WaterDetail => {
  const { units, waterMeters, periodStart, periodEnd } = input;

  const mainMeters = waterMeters.filter((m) => m.meter.role === "main");
  if (mainMeters.length === 0) {
    throw new CalculationError("waterNoMainMeter");
  }

  const warnings: CalcWarning[] = [];
  const bundles = new Map<string, WaterMeterBundle>(
    waterMeters.map((bundle) => [bundle.meter.id, bundle]),
  );

  // Mehrere Hauptzähler entstehen durch Zählertausche (überlappungsfreie
  // Gültigkeit). Jeder Record steuert seinen Verbrauch über seinen
  // eigenen Gültigkeitszeitraum bei. `computeMeterConsumption` klemmt
  // die Periode automatisch auf [validFrom, validUntil].
  const totalConsumptionM3 = mainMeters.reduce(
    (acc, bundle) =>
      acc +
      computeMeterConsumption(
        bundle.meter.id,
        bundles,
        periodStart,
        periodEnd,
        undefined,
        // Kein eigenes `label` - sonst entsteht "Haupt (Haupt)"
        { warnings },
      ),
    0,
  );

  const unitConsumption = new Map<string, number>();
  const unitDifferential = new Map<string, WaterMeterBundle>();
  // Pro Wohnung die beitragenden Wasserzähler mit ihrem Einzelverbrauch.
  // Die PDF-Fußnote weist diese Liste aus ("ermittelt durch ..."). Wichtig:
  // Differenzzähler erscheinen hier als **ein** Eintrag mit ihrem End-
  // Verbrauch - die innere Differenz-Formel wird bewusst nicht offengelegt,
  // weil sie Zählerstände anderer Wohnungen preisgeben würde.
  const unitMeters = new Map<
    string,
    Array<{ label: string; consumptionM3: number }>
  >();
  for (const unit of units) {
    unitConsumption.set(unit.id, 0);
    unitMeters.set(unit.id, []);
  }

  // Wohnungs-, Allgemein- und Differenzzähler aggregieren.
  for (const bundle of waterMeters) {
    const { meter } = bundle;

    if (
      meter.role !== "unit" &&
      meter.role !== "common" &&
      meter.role !== "virtual_difference"
    ) {
      continue;
    }

    if (!meter.unitId) {
      if (meter.role === "unit") {
        throw new Error(`Unit meter ${meter.id} has no unitId`);
      }

      // Ein Allgemeinzähler ohne Unit-Zuordnung wird keiner Wohnung gutge-
      // schrieben, sein Verbrauch steckt aber im Hauptzähler-Total und wird
      // dadurch bei `per_consumption_m3` lautlos anteilig auf alle Mieter
      // mitverteilt (kein Vorwegabzug).
      if (meter.role === "common") {
        warnings.push({
          code: "commonConsumptionUnallocated",
          params: { label: meter.label },
        });
      }

      continue;
    }

    // Zähler, deren Gültigkeit die Statement-Periode nicht schneidet,
    // tragen weder zum Verbrauch noch zur Fußnoten-Liste bei.
    const { validFrom, validUntil } = meter;
    const overlapStart = validFrom > periodStart ? validFrom : periodStart;
    const overlapEnd =
      validUntil && validUntil < periodEnd ? validUntil : periodEnd;

    if (overlapStart > overlapEnd) {
      continue;
    }

    // Kein eigenes `label`: `computeMeterConsumption` benennt physische
    // Zähler selbst (bundle.meter.label). Ein Label würde zu
    // "Küche (Küche)"-Doppelungen führen.
    const consumption = computeMeterConsumption(
      meter.id,
      bundles,
      periodStart,
      periodEnd,
      undefined,
      { warnings },
    );

    unitConsumption.set(
      meter.unitId,
      (unitConsumption.get(meter.unitId) ?? 0) + consumption,
    );

    unitMeters
      .get(meter.unitId)
      ?.push({ label: meter.label, consumptionM3: consumption });

    if (meter.role === "virtual_difference") {
      unitDifferential.set(meter.unitId, bundle);
    }
  }

  const perUnit: WaterDetail["perUnit"] = units.map((unit) => {
    const consumptionM3 = unitConsumption.get(unit.id) ?? 0;
    const diffBundle = unitDifferential.get(unit.id);
    const sharePct =
      totalConsumptionM3 > 0 ? (consumptionM3 / totalConsumptionM3) * 100 : 0;

    return {
      unitId: unit.id,
      unitName: unit.name,
      consumptionM3,
      sharePct,
      isDifferential: diffBundle !== undefined,
      meterContributions: unitMeters.get(unit.id) ?? [],
    };
  });

  const dedupedWarnings = dedupe(warnings);
  return {
    totalConsumptionM3,
    perUnit,
    ...(dedupedWarnings.length > 0 ? { warnings: dedupedWarnings } : {}),
  };
};
