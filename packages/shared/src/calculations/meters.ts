import { formatNumberLoose } from "../format.js";
import type { ReadingPoint } from "../types/index.js";
import { CalculationError, type CalcWarning } from "./diagnostics.js";
import { addDaysIso, daysBetween } from "./period.js";

export type InterpolateOptions = {
  warnings?: CalcWarning[];
  label?: string;
  relevantPeriod?: { start: string; end: string };
  /**
   * Stichtag des Zählers als `MM-TT`
   */
  resetDay?: string | null;
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
 * Stichtage, die in `[fromDate, toDate]` liegen. Der Stichtag selbst
 * gehört noch zur ablaufenden Zählung: Der Stand an diesem Tag ist der
 * Jahreswert, der Neubeginn zeigt sich erst am Tag danach. Deshalb zählt
 * der Anfang mit und das Ende nicht.
 */
export const resetDatesBetween = (
  resetDay: string | null | undefined,
  fromDate: string,
  toDate: string,
): string[] => {
  if (!resetDay) {
    return [];
  }

  const dates: string[] = [];
  const firstYear = Number(fromDate.slice(0, 4));
  const lastYear = Number(toDate.slice(0, 4));

  for (let year = firstYear; year <= lastYear; year++) {
    const resetDate = `${year}-${resetDay}`;
    if (fromDate <= resetDate && resetDate < toDate) {
      dates.push(resetDate);
    }
  }

  return dates;
};

/**
 * True, wenn zwischen zwei Daten ein Stichtag liegt, das Gerät die Zählung
 * dazwischen also neu begonnen hat.
 */
export const hasResetBetween = (
  resetDay: string | null | undefined,
  fromDate: string,
  toDate: string,
): boolean => resetDatesBetween(resetDay, fromDate, toDate).length > 0;

/**
 * Der letzte Stichtag zwischen zwei Daten, sonst `null`.
 */
export const lastResetBetween = (
  resetDay: string | null | undefined,
  fromDate: string,
  toDate: string,
): string | null =>
  resetDatesBetween(resetDay, fromDate, toDate).at(-1) ?? null;

/**
 * Meldet einen rückläufigen Stand zwischen chronologisch benachbarten
 * Ablesungen eines kumulativen Zählers (Zählertausch ohne Erfassung des
 * Endstands, Ablesefehler, vertauschte Werte).
 *
 * Gewarnt wird nicht, wenn der rückläufiger Zählersprung außerhalb der
 * gegegeben Periode liegt.
 */
const warnNonMonotonic = (
  readings: ReadingPoint[],
  periodStart: string,
  periodEnd: string,
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

    if (after.date < periodStart || before.date >= periodEnd) {
      continue;
    }

    if (hasResetBetween(options.resetDay, before.date, after.date)) {
      continue;
    }

    const params = {
      fromDate: before.date,
      toDate: after.date,
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
      options.warnings.push({
        code: "readingNonMonotonic",
        params,
        detail: {
          fromValue: formatNumberLoose(before.value),
          toValue: formatNumberLoose(after.value),
        },
      });
    }
  }
};

/**
 * Meldet einen auf null begrenzten negativen Verbrauch. Je Zähler nur
 * einmal, weil derselbe Zähler während einer Abrechnung mehrfach
 * ausgewertet wird (je Wohnung, je Kostenart).
 */
const warnNegativeConsumption = (options?: InterpolateOptions): void => {
  if (!options?.warnings) {
    return;
  }

  const duplicate = options.warnings.some(
    (existing) =>
      existing.code === "consumptionNegative" &&
      existing.params?.label === options.label,
  );

  if (!duplicate) {
    options.warnings.push({
      code: "consumptionNegative",
      ...(options.label ? { params: { label: options.label } } : {}),
    });
  }
};

/**
 * Verbrauch eines Abschnitts ohne Neubeginn der Zählung: Endstand minus
 * Anfangsstand, auf 0 begrenzt.
 */
const consumptionOfSegment = (
  readings: ReadingPoint[],
  segmentStart: string,
  segmentEnd: string,
  options?: InterpolateOptions,
): number => {
  const startValue = interpolateReading(readings, segmentStart, options);
  const endValue = interpolateReading(readings, segmentEnd, options);
  const consumption = endValue - startValue;

  // Ein rückwärts laufender Zähler, ein Zahlendreher beim Ablesen oder ein
  // Gerätetausch ohne Endstand ergäben einen negativen Verbrauch. Der würde
  // als negatives Gewicht die proportionale Verteilung für ALLE Wohnungen
  // verzerren (eine Wohnung zahlt mehr als den ganzen Topf, die andere bekommt
  // etwas gutgeschrieben). Darum 0 und Warnung, wie beim Differenzzähler.
  if (consumption < 0) {
    warnNegativeConsumption(options);

    return 0;
  }

  return consumption;
};

/**
 * Die Ablesungen eines Abschnitts: alles zwischen dem vorigen und dem
 * abschließenden Stichtag. Beginnt der Abschnitt nach einem Stichtag, stand
 * das Gerät an seinem ersten Tag auf 0; fehlt dafür eine Ablesung, ergänzt
 * der Abschnitt sie, damit der Verbrauch ab dem Neubeginn zählt.
 */
const segmentReadings = (
  readings: ReadingPoint[],
  segmentStart: string,
  previousReset: string | null,
  reset: string | null,
): ReadingPoint[] => {
  const within = readings.filter(
    (reading) =>
      (previousReset === null || reading.date > previousReset) &&
      (reset === null || reading.date <= reset),
  );

  if (previousReset === null || within.some((r) => r.date === segmentStart)) {
    return within;
  }

  return [
    { date: segmentStart, value: 0, isCumulative: true, isEstimated: false },
    ...within,
  ];
};

/**
 * Verbrauch zwischen zwei Stichtagen für einen kumulativen Zähler.
 *
 * Wichtig: Angrenzende Mietperioden nutzen die tatsächlichen
 * Übergabestände (Auszug A = Einzug B, meist derselbe Stand am selben
 * Tag). Ein Zwischenraum ist Leerstandsverbrauch zulasten des Vermieters.
 *
 * Beginnt das Gerät innerhalb der Periode neu zu zählen (Stichtag eines
 * Heizkostenverteilers), zerfällt sie in Abschnitte.
 */
export const consumptionBetween = (
  readings: ReadingPoint[],
  periodStart: string,
  periodEnd: string,
  options?: InterpolateOptions,
): number => {
  warnNonMonotonic(readings, periodStart, periodEnd, options);

  const resets = resetDatesBetween(options?.resetDay, periodStart, periodEnd);

  if (resets.length === 0) {
    return consumptionOfSegment(readings, periodStart, periodEnd, options);
  }

  let total = 0;
  let segmentStart = periodStart;
  let previousReset: string | null = null;

  for (const reset of [...resets, null]) {
    const segmentEnd = reset ?? periodEnd;

    total += consumptionOfSegment(
      segmentReadings(readings, segmentStart, previousReset, reset),
      segmentStart,
      segmentEnd,
      options,
    );

    previousReset = reset;
    segmentStart = reset === null ? segmentStart : addDaysIso(reset, 1);
  }

  return total;
};
