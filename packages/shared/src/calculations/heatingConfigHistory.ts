import type { HeatingSettings } from "../schemas/heating.js";
import type { Period } from "../types/index.js";
import { hasBlockingWarning } from "./diagnostics.js";
import { resolveHeatingConfigForPeriod } from "./heatingConfigResolution.js";
import { addDaysIso } from "./period.js";

/**
 * Bei welcher Abrechnungsart ein Feld der Version fachlich zählt. In den
 * übrigen Arten steht dort ein Füllwert, den niemand liest. "technical"
 * beschreibt die Version selbst, nicht den Tag; Gültigkeit wirkt nur
 * darüber, welche Version an welchem Tag gilt.
 */
type HistoryFieldScope = "all" | "internal" | "external" | "technical";

/**
 * Zuordnung jedes Felds der Version. Ein neues Feld muss hier eingetragen
 * werden, sonst scheitert der Typecheck.
 */
export const HEATING_HISTORY_FIELD_SCOPES: Record<
  keyof HeatingSettings,
  HistoryFieldScope
> = {
  id: "technical",
  buildingId: "technical",
  validFrom: "technical",
  validTo: "technical",
  createdAt: "technical",
  updatedAt: "technical",
  mode: "all",
  includeBillingInfo: "external",
  baseSharePercent: "internal",
  consumptionSharePercent: "internal",
  baseMethod: "internal",
  consumptionMethod: "internal",
  prorationMethod: "internal",
  heatingType: "internal",
  fuelType: "internal",
  hotWaterMeterId: "internal",
  hotWaterSupplyTemperatureCelsius: "internal",
  gasBillingByCalorificValue: "internal",
  heatPumpMonovalent: "internal",
  mandatorySeventyPercent: "internal",
  co2CostShareEnabled: "internal",
  co2BuildingRestricted: "internal",
  co2SupplyRestricted: "internal",
  co2RestrictionEvidenceNote: "internal",
  seventyInsulationAnswer: "internal",
  seventyPipesAnswer: "internal",
  co2BuildingRestrictionAnswer: "internal",
  co2SupplyRestrictionAnswer: "internal",
};

const historyFields = Object.entries(HEATING_HISTORY_FIELD_SCOPES) as [
  keyof HeatingSettings,
  HistoryFieldScope,
][];

/**
 * Fachliche Werte einer Version nach ihrer Abrechnungsart, als
 * vergleichbarer Schlüssel. Füllwerte und technische Felder fehlen.
 */
export const heatingSettingsProjection = (version: HeatingSettings): string =>
  JSON.stringify(
    historyFields
      .filter(([, scope]) => scope === "all" || scope === version.mode)
      .map(([field]) => [field, version[field]]),
  );

/**
 * Abschnitt des Verlaufs: an allen Tagen gelten dieselben Werte. Leer
 * heißt: keine Version. Mehrere Werte gibt es nur bei einer Überlappung.
 */
export type HeatingConfigHistorySegment = Period & { values: string[] };

const daysOf = (period: Period): string[] => {
  const days: string[] = [];
  for (let day = period.start; day <= period.end; day = addDaysIso(day, 1)) {
    days.push(day);
  }

  return days;
};

const valuesAt = (
  versions: readonly HeatingSettings[],
  day: string,
): string[] =>
  versions
    .filter(
      (version) =>
        version.validFrom <= day &&
        (version.validTo === null || version.validTo >= day),
    )
    .map(heatingSettingsProjection)
    .sort();

const sameValues = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

/**
 * Verlauf der Heizkostenkonfiguration in einem Zeitraum: Folge der
 * Abschnitte mit gleichen Werten, benachbarte gleiche zusammengelegt.
 */
export const heatingConfigHistory = (
  versions: readonly HeatingSettings[],
  period: Period,
): HeatingConfigHistorySegment[] => {
  const segments: HeatingConfigHistorySegment[] = [];
  for (const day of daysOf(period)) {
    const values = valuesAt(versions, day);
    const last = segments.at(-1);
    if (last && sameValues(last.values, values)) {
      last.end = day;
    } else {
      segments.push({ start: day, end: day, values });
    }
  }

  return segments;
};

const NONE_VALUES = [
  heatingSettingsProjection({ mode: "none" } as HeatingSettings),
];

/**
 * Ganzer Zeitraum ohne Version und ganzer Zeitraum ohne Heizkosten-
 * abrechnung gelten für die Sperre als gleich: Aus beiden entsteht keine
 * Abrechnung mit Heizkostenteil.
 */
const withoutHeatingPart = (history: HeatingConfigHistorySegment[]) =>
  history.length === 1 &&
  (history[0]?.values.length === 0 ||
    sameValues(history[0]?.values ?? [], NONE_VALUES));

const historiesEqual = (
  left: HeatingConfigHistorySegment[],
  right: HeatingConfigHistorySegment[],
) =>
  JSON.stringify(left) === JSON.stringify(right) ||
  (withoutHeatingPart(left) && withoutHeatingPart(right));

const isBlocked = (versions: readonly HeatingSettings[], period: Period) => {
  const resolution = resolveHeatingConfigForPeriod(versions, period);

  return (
    resolution.settings === null ||
    hasBlockingWarning({ heatingConfigWarnings: resolution.warnings })
  );
};

/**
 * Ergebnis der Sperre für einen finalisierten Zeitraum:
 * - "allowed": Änderung erlaubt
 * - "finalizedImmutable": Verlauf ändert sich
 * - "legacyRepairOnly": Zeitraum aus der Zeit vor der Sperre, die Änderung
 *   führt ihn nicht auf die Version vom ersten Tag zurück
 */
export type HeatingConfigChangeVerdict =
  | "allowed"
  | "finalizedImmutable"
  | "legacyRepairOnly";

/**
 * Ob die Versionen eines Gebäudes von `before` auf `after` wechseln
 * dürfen, während für `period` eine finalisierte Abrechnung besteht.
 *
 * Der Verlauf im Zeitraum muss gleich bleiben. Einzige Ausnahme neben
 * "ohne Heizkostenteil": Ist der Zeitraum vorher nach der Auflösung
 * blockiert, wurde er vor der Sperre finalisiert, und zwar mit der
 * Version vom ersten Tag (Bezugszustand). Dann darf jeder Tag nur
 * gleich bleiben, den Bezugszustand bekommen oder leer werden; Tage im
 * Bezugszustand bleiben es, und rechenbar wird der Zeitraum nur als
 * Bezugszustand allein. Ob blockiert, entscheidet nur die Auflösung der
 * Versionen, nie die Rechnungen: Die lassen sich nach dem Finalisieren
 * noch ändern und dürfen die Sperre nicht aufheben.
 */
export const heatingConfigChangeVerdict = (
  before: readonly HeatingSettings[],
  after: readonly HeatingSettings[],
  period: Period,
): HeatingConfigChangeVerdict => {
  if (
    historiesEqual(
      heatingConfigHistory(before, period),
      heatingConfigHistory(after, period),
    )
  ) {
    return "allowed";
  }
  if (!isBlocked(before, period)) {
    return "finalizedImmutable";
  }

  const days = daysOf(period);
  const beforeDays = days.map((day) => valuesAt(before, day));
  const afterDays = days.map((day) => valuesAt(after, day));
  const firstDay = beforeDays[0] ?? [];
  // Bei einer Überlappung am ersten Tag ist jede der Versionen dort ein
  // möglicher Bezugszustand
  const references: (string | null)[] =
    firstDay.length === 0 ? [null] : [...new Set(firstDay)];
  const afterBlocked = isBlocked(after, period);

  const repairs = references.some((reference) => {
    const isReference = (values: string[]) =>
      reference === null
        ? values.length === 0
        : values.length === 1 && values[0] === reference;

    const everyDayRepairs = beforeDays.every((previous, index) => {
      const next = afterDays[index] ?? [];
      if (isReference(previous)) {
        return isReference(next);
      }
      return (
        sameValues(previous, next) || isReference(next) || next.length === 0
      );
    });

    return everyDayRepairs && (afterBlocked || afterDays.every(isReference));
  });

  if (repairs) {
    return "allowed";
  }

  return references[0] === null ? "finalizedImmutable" : "legacyRepairOnly";
};
