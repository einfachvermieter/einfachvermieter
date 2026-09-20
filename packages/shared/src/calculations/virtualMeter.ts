import type { MeterInfo, ReadingPoint } from "../types/index.js";
import { CalculationError } from "./diagnostics.js";
import { consumptionBetween, type InterpolateOptions } from "./meters.js";

/**
 * Konfiguration eines Differenzzählers (`role = "virtual_difference"`):
 * Stand = Verbrauch(`baseMeterId`) − Summe Verbrauch(`subtractedMeterIds`).
 */
export type DifferenceConfigInput = {
  baseMeterId: string;
  subtractedMeterIds: string[];
};

/**
 * Eingabebündel pro Zähler für die Berechnung. `differenceConfig` ist nur
 * bei virtuellen Differenzzählern gesetzt - physische Zähler liefern ihre
 * Werte über `readings`.
 */
export type MeterBundle = {
  meter: MeterInfo;
  readings: ReadingPoint[];
  differenceConfig?: DifferenceConfigInput | null;
};

/**
 * Liefert den Verbrauch eines beliebigen Zählers über den Zeitraum.
 * Für physische Zähler wird linear zwischen Zählerständen interpoliert
 * (`consumptionBetween`). Differenzzähler werden rekursiv aufgelöst:
 * Quellen, die wiederum virtuell sind, werden ihrerseits berechnet.
 *
 * Wirft bei zyklischer Verkettung oder fehlender Konfiguration. Eine
 * fachliche Validierung der Konfiguration (gleicher Typ, gleiches
 * Gebäude, kein Self-Reference) findet bereits beim Speichern statt;
 * hier ist der Fokus rein auf Auflösung der Werte.
 */
export const computeMeterConsumption = (
  meterId: string,
  bundles: Map<string, MeterBundle>,
  periodStart: string,
  periodEnd: string,
  visited: Set<string> = new Set(),
  options?: InterpolateOptions,
): number => {
  if (visited.has(meterId)) {
    throw new CalculationError("differenceMeterCyclic", {
      chain: [...visited, meterId].join(" → "),
    });
  }

  const bundle = bundles.get(meterId);
  if (!bundle) {
    throw new Error(`Meter not found: ${meterId}`);
  }

  // Periode auf die Gültigkeit des Zählers klemmen. Ein Zählertausch wird
  // als zwei Records mit überlappungsfreier Gültigkeit modelliert; jeder beiträgt
  // nur über seinen eigenen Zeitraum. Bei Differenzzählern propagiert die
  // geklemmte Periode rekursiv an Basis- und Subtraktionszähler.
  const { validFrom, validUntil } = bundle.meter;
  const clampedStart = validFrom > periodStart ? validFrom : periodStart;
  const clampedEnd =
    validUntil && validUntil < periodEnd ? validUntil : periodEnd;
  if (clampedStart > clampedEnd) {
    return 0;
  }

  // Per-Meter-Label, damit gesammelte Warnungen den Zähler benennen.
  const meterOptions: InterpolateOptions | undefined = options
    ? {
        warnings: options.warnings,
        label: options.label
          ? `${options.label} (${bundle.meter.label})`
          : bundle.meter.label,
        resetDay: bundle.meter.resetDay,
      }
    : undefined;

  if (bundle.meter.role !== "virtual_difference") {
    return consumptionBetween(
      bundle.readings,
      clampedStart,
      clampedEnd,
      meterOptions,
    );
  }

  const cfg = bundle.differenceConfig;
  if (!cfg) {
    throw new CalculationError("differenceMeterNoConfig", {
      label: bundle.meter.label,
    });
  }

  const nextVisited = new Set(visited);
  nextVisited.add(meterId);

  const baseConsumption = computeMeterConsumption(
    cfg.baseMeterId,
    bundles,
    clampedStart,
    clampedEnd,
    nextVisited,
    options,
  );

  const subtractedSum = cfg.subtractedMeterIds.reduce(
    (acc, id) =>
      acc +
      computeMeterConsumption(
        id,
        bundles,
        clampedStart,
        clampedEnd,
        nextVisited,
        options,
      ),
    0,
  );

  const difference = baseConsumption - subtractedSum;

  // Übersteigt die Summe der Subtraktionszähler den Basiszähler (unvollständige
  // Quellzähler, Ablesefehler), entstünde ein negativer Verbrauch. Der würde als
  // negatives Gewicht die proportionale Verteilung in `distributeCents` für ALLE
  // Wohnungen verzerren. Darum 0 und Warning
  if (difference < 0) {
    options?.warnings?.push({
      code: "differenceMeterNegative",
      params: { label: bundle.meter.label },
    });

    return 0;
  }

  return difference;
};
