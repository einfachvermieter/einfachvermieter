import { formatNumberLoose } from "../format.js";
import type { ReadingPoint } from "../types/index.js";
import { CalculationError, type CalcWarning } from "./diagnostics.js";
import { daysBetween } from "./period.js";

export type InterpolateOptions = {
  warnings?: CalcWarning[];
  label?: string;
  relevantPeriod?: { start: string; end: string };
  /**
   * Gewichtung/Heizung nutzt Gradtage
   */
  intervalWeight?: (fromDate: string, toDate: string) => number;
};

/**
 * Lineare Interpolation zwischen zwei umschließenden Ständen.
 *
 * Ohne `intervalWeight` zeitanteilig nach Kalendertagen; mit Gewichtung
 * gradtagsbasiert.
 */
const lerpBetween = (
  before: ReadingPoint,
  after: ReadingPoint,
  targetDate: string,
  intervalWeight?: (fromDate: string, toDate: string) => number,
): number => {
  const total = intervalWeight
    ? intervalWeight(before.date, after.date)
    : daysBetween(before.date, after.date) - 1;

  if (total <= 0) {
    return before.value;
  }

  const elapsed = intervalWeight
    ? intervalWeight(before.date, targetDate)
    : daysBetween(before.date, targetDate) - 1;

  const factor = elapsed / total;

  return before.value + (after.value - before.value) * factor;
};

/**
 * Meldet, dass der Wert zum Stichtag auf einem geschätzten Ablesewert
 * beruht (rechtlich relevante Kennzeichnung in Abrechnung/PDF).
 */
const warnEstimated = (
  estimatedReadings: ReadingPoint[],
  options?: InterpolateOptions,
): void => {
  if (!options?.warnings) {
    return;
  }

  for (const reading of estimatedReadings) {
    if (!reading.isEstimated) {
      continue;
    }

    const params = {
      date: reading.date,
      ...(options.label ? { label: options.label } : {}),
    };

    const duplicate = options.warnings.some(
      (existing) =>
        existing.code === "readingEstimated" &&
        existing.params?.date === params.date &&
        existing.params?.label === params.label,
    );

    if (!duplicate) {
      options.warnings.push({ code: "readingEstimated", params });
    }
  }
};

/**
 * True, wenn der Stand zum Stichtag nicht direkt abgelesen wurde: es gibt
 * keine Ablesung an diesem Tag (der Wert wird also interpoliert, extrapoliert
 * oder auf den letzten Stand gesetzt) oder die Ablesung ist selbst geschätzt.
 */
export const isDerivedAtDate = (
  readings: ReadingPoint[],
  date: string,
): boolean => {
  const exact = readings.find((reading) => reading.date === date);

  return exact === undefined || exact.isEstimated;
};

/**
 * True, wenn einer der beiden Stichtagsstände rechnerisch ermittelt ist, der
 * Verbrauch der Periode also nicht auf zwei echten Ablesungen beruht.
 */
export const isDerivedConsumption = (
  readings: ReadingPoint[],
  periodStart: string,
  periodEnd: string,
): boolean =>
  isDerivedAtDate(readings, periodStart) ||
  isDerivedAtDate(readings, periodEnd);

/**
 * Interpoliert einen Zählerstand für ein Datum (nur für kumulative Zähler)
 */
export const interpolateReading = (
  readings: ReadingPoint[],
  targetDate: string,
  options?: InterpolateOptions,
): number => {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  const [first] = sorted;
  const last = sorted.at(-1);

  if (!first || !last) {
    throw new CalculationError("readingNoneAvailable", {
      date: targetDate,
      ...(options?.label ? { label: options.label } : {}),
    });
  }

  const exact = sorted.find((reading) => reading.date === targetDate);
  if (exact) {
    warnEstimated([exact], options);
    return exact.value;
  }

  const isRelevant = (date: string): boolean =>
    !options?.relevantPeriod ||
    (date >= options.relevantPeriod.start &&
      date <= options.relevantPeriod.end);

  const clampToBoundary = (
    value: number,
    warning: CalcWarning,
    throwMessage: string,
  ): number => {
    if (!options?.warnings) {
      throw new Error(throwMessage);
    }

    if (isRelevant(targetDate)) {
      const params = options.label
        ? { ...warning.params, label: options.label }
        : warning.params;
      const entry = params ? { ...warning, params } : warning;
      const duplicate = options.warnings.some(
        (existing) =>
          existing.code === entry.code &&
          existing.params?.date === entry.params?.date &&
          existing.params?.label === entry.params?.label,
      );
      if (!duplicate) {
        options.warnings.push(entry);
      }
    }

    return value;
  };

  if (targetDate < first.date) {
    warnEstimated([first], options);
    return clampToBoundary(
      first.value,
      { code: "readingMissingBefore", params: { date: first.date } },
      `Target date ${targetDate} is before first reading ${first.date}, extrapolation not allowed.`,
    );
  }

  if (targetDate > last.date) {
    warnEstimated([last], options);
    return clampToBoundary(
      last.value,
      { code: "readingMissingAfter", params: { date: last.date } },
      `Target date ${targetDate} is after last reading ${last.date}, extrapolation not allowed.`,
    );
  }

  const afterIndex = sorted.findIndex((reading) => reading.date > targetDate);
  const before = sorted[afterIndex - 1];
  const after = sorted[afterIndex];

  if (!before || !after) {
    throw new Error(`Interpolation error for ${targetDate}`);
  }

  warnEstimated([before, after], options);

  return lerpBetween(before, after, targetDate, options?.intervalWeight);
};

/**
 * Meldet einen rückläufigen Stand zwischen chronologisch benachbarten
 * Ablesungen eines kumulativen Zählers (Zählertausch ohne Erfassung des
 * Endstands, Ablesefehler, vertauschte Werte).
 */
const warnNonMonotonic = (
  readings: ReadingPoint[],
  options?: InterpolateOptions,
): void => {
  if (!options?.warnings) {
    return;
  }

  const cumulative = readings
    .filter((reading) => reading.isCumulative)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 1; i < cumulative.length; i++) {
    const before = cumulative[i - 1];
    const after = cumulative[i];
    if (!before || !after || after.value >= before.value) {
      continue;
    }

    const params = {
      fromDate: before.date,
      fromValue: formatNumberLoose(before.value),
      toDate: after.date,
      toValue: formatNumberLoose(after.value),
      ...(options.label ? { label: options.label } : {}),
    };

    const duplicate = options.warnings.some(
      (existing) =>
        existing.code === "readingNonMonotonic" &&
        existing.params?.fromDate === params.fromDate &&
        existing.params?.toDate === params.toDate &&
        existing.params?.label === params.label,
    );

    if (!duplicate) {
      options.warnings.push({ code: "readingNonMonotonic", params });
    }
  }
};

/**
 * Verbrauch zwischen zwei Stichtagen für einen kumulativen Zähler.
 *
 * Wichtig: Angrenzende Mietperioden nutzen die tatsächlichen
 * Übergabestände (Auszug A = Einzug B, meist derselbe Stand am selben
 * Tag). Ein Zwischenraum ist Leerstandsverbrauch zulasten des Vermieters.
 */
export const consumptionBetween = (
  readings: ReadingPoint[],
  periodStart: string,
  periodEnd: string,
  options?: InterpolateOptions,
): number => {
  warnNonMonotonic(readings, options);

  const startValue = interpolateReading(readings, periodStart, options);
  const endValue = interpolateReading(readings, periodEnd, options);

  return endValue - startValue;
};
