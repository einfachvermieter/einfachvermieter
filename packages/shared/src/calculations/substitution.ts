/**
 * Erfassungsausfälle nach § 9a HeizkostenV: Messdatenlücken erkennen,
 * Ersatzverbräuche nach den drei Verfahren aus Abs. 1 ermitteln, die
 * 25-%-Grenze aus Abs. 2 prüfen und Ausgleichsstände aus früheren Perioden
 * einfügen. Rein, alle Daten kommen vom Aufrufer.
 */

import { shiftIsoYears } from "../date.js";
import type {
  ConsumptionSubstitution,
  SubstitutionMethod,
  SubstitutionReason,
  SubstitutionScope,
} from "../schemas/consumption-substitutions.js";
import type {
  CompensationSnapshot,
  MeterInfo,
  Period,
  ReadingPoint,
  SubstitutionSnapshot,
} from "../types/index.js";
import type { CalcWarning } from "./diagnostics.js";
import {
  classifyPeriodBoundaries,
  consumptionBetween,
  interpolateReading,
} from "./meters.js";
import { addDaysIso, daysBetween } from "./period.js";
import {
  daysOfPeriods,
  missingSupplyReadings,
  readingsForSuppliedPeriod,
  suppliedPeriodsOf,
  supplyStateOf,
  type UnitSupply,
} from "./supply.js";

/**
 * Erfassungsausfall, wie ihn die Berechnung braucht
 */
export type SubstitutionInput = Omit<
  ConsumptionSubstitution,
  "buildingId" | "decidedByUserId" | "createdAt" | "updatedAt"
>;

export type ScopeMeter = {
  meter: MeterInfo;
  readings: ReadingPoint[];
};

/**
 * Ausgleichsstand eines fortlaufenden Zählers am Ende einer früheren
 * Ausfallperiode: Anfangsstand dieser Periode plus abgerechneter
 * Ersatzverbrauch.
 */
export type CompensationInput = {
  meterId: string;
  scope: SubstitutionScope;
  sourcePeriod: Period;
  substitutionId: string;
  method: SubstitutionMethod;
  reason: SubstitutionReason;
  periodStartValue: number;
  substituteConsumption: number;
  fromSnapshotOfStatementId?: string;
};

/**
 * Ablesungen eines Zählers, der in einer früheren Periode ausgefallen ist
 * und nicht weitergezählt hat: Stände bis einschließlich `through` sind für
 * spätere Perioden keine Stützstelle mehr.
 */
export type ReadingInvalidation = {
  meterId: string;
  through: string;
};

/**
 * Zähler, deren Verbrauch in einer früheren Periode selbst ersetzt wurde.
 * Ein solcher Zeitraum taugt nicht als Vergleichszeitraum.
 */
export type SubstitutedPeriodMeters = {
  period: Period;
  meterIds: string[];
};

export const compensationValue = (compensation: CompensationInput): number =>
  compensation.periodStartValue + compensation.substituteConsumption;

/**
 * Fügt Ausgleichsstände als Stützstellen ein und entfernt entwertete
 * Ablesungen. Der Ausgleichsstand steht am letzten Tag der Ausfallperiode
 * und am ersten Tag danach, wie eine Ablesung zum Jahreswechsel; echte
 * Ablesungen an diesen Tagen verdrängt er.
 */
export const applyCompensations = (
  meterId: string,
  readings: ReadingPoint[],
  compensations: CompensationInput[],
  invalidations: ReadingInvalidation[],
): ReadingPoint[] => {
  const invalidThrough = invalidations
    .filter((entry) => entry.meterId === meterId)
    .reduce<string | null>(
      (latest, entry) =>
        latest === null || entry.through > latest ? entry.through : latest,
      null,
    );

  const points: ReadingPoint[] = compensations
    .filter((entry) => entry.meterId === meterId)
    .flatMap((entry) => {
      const value = compensationValue(entry);
      const base = {
        value,
        isCumulative: true,
        isEstimated: false,
        compensation: true as const,
      };

      return [
        { ...base, date: entry.sourcePeriod.end },
        { ...base, date: addDaysIso(entry.sourcePeriod.end, 1) },
      ];
    });
  const pointDates = new Set(points.map((point) => point.date));

  return [
    ...readings.filter(
      (reading) =>
        !pointDates.has(reading.date) &&
        (invalidThrough === null || reading.date > invalidThrough),
    ),
    ...points,
  ].sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Ausgleichsstände, die in die Periode hineinwirken, mit dem nächsten
 * echten Stand. Negativ ist ein Ausgleich, wenn der nächste Stand nach dem
 * Ausgleichsstand eine echte Ablesung unter ihm ist.
 */
export const relevantCompensations = (
  meter: ScopeMeter,
  compensations: CompensationInput[],
  period: Period,
): Array<{
  compensation: CompensationInput;
  nextReading: ReadingPoint | null;
  resultingConsumption: number | null;
  isNegative: boolean;
}> =>
  compensations
    .filter(
      (entry) =>
        entry.meterId === meter.meter.id && entry.sourcePeriod.end < period.end,
    )
    .flatMap((compensation) => {
      const afterDate = addDaysIso(compensation.sourcePeriod.end, 1);
      const later = meter.readings.filter(
        (reading) => reading.date > afterDate,
      );
      const nextPoint = later[0] ?? null;
      if (nextPoint !== null && nextPoint.date <= period.start) {
        return [];
      }

      const nextReading =
        later.find((reading) => !reading.compensation) ?? null;
      const value = compensationValue(compensation);
      const resultingConsumption =
        nextPoint !== null && !nextPoint.compensation
          ? nextPoint.value - value
          : null;

      return [
        {
          compensation,
          nextReading,
          resultingConsumption,
          isNegative: resultingConsumption !== null && resultingConsumption < 0,
        },
      ];
    });

/**
 * Verbrauch eines Zählers über die ganze Periode, bei HKV mit `kTotal`
 * gewichtet. Ohne Ablesungen 0.
 */
export const fullPeriodConsumption = (
  scopeMeter: ScopeMeter,
  period: Period,
  intervalWeight?: (fromDate: string, toDate: string) => number,
): number => {
  if (scopeMeter.readings.length === 0) {
    return 0;
  }

  const delta = consumptionBetween(
    scopeMeter.readings,
    period.start,
    period.end,
    {
      warnings: [],
      resetDay: scopeMeter.meter.resetDay,
      intervalWeight,
    },
  );

  return scopeMeter.meter.type === "heat_cost_allocator"
    ? delta * (scopeMeter.meter.kTotal ?? 0)
    : delta;
};

const sum = (values: number[]): number =>
  values.reduce((acc, value) => acc + value, 0);

/**
 * Zähler, deren Verbrauch in einem Zeitraum, der `period` überschneidet,
 * selbst ersetzt wurde
 */
const substitutedMeterIdsIn = (
  substitutedPeriods: SubstitutedPeriodMeters[],
  period: Period,
): Set<string> =>
  new Set(
    substitutedPeriods
      .filter(
        (entry) =>
          entry.period.start <= period.end && entry.period.end >= period.start,
      )
      .flatMap((entry) => entry.meterIds),
  );

const isUsableBoundary = (kind: string): boolean =>
  kind === "read" || kind === "interpolated";

/**
 * Ob beide Stichtage des Zeitraums ordnungsgemäß erfasst sind (echt oder
 * zwischen echten Ablesungen)
 */
const isProperlyRecorded = (
  scopeMeter: ScopeMeter,
  period: Period,
): boolean => {
  const kinds = classifyPeriodBoundaries(
    scopeMeter.readings,
    period.start,
    period.end,
    scopeMeter.meter.resetDay,
  );

  return isUsableBoundary(kinds.start) && isUsableBoundary(kinds.end);
};

const isValidIn = (meter: MeterInfo, period: Period): boolean =>
  meter.validFrom <= period.end &&
  (meter.validUntil === null || meter.validUntil >= period.start);

/**
 * Zähler, die im Vergleichszeitraum ordnungsgemäß erfasst sein müssen: die
 * betroffenen (bzw. Vorgänger-)Zähler und bei HKV zusätzlich alle HKV des
 * Gebäudes, die dort gültig waren. Die betroffenen gehören immer dazu, auch
 * wenn sie im Vergleichszeitraum noch nicht eingebaut waren.
 */
const referenceCheckSet = (
  referenceMeters: ScopeMeter[],
  referenceAffected: ScopeMeter[],
  referencePeriod: Period,
  shareMethod: boolean,
): ScopeMeter[] => {
  if (!shareMethod) {
    return referenceAffected;
  }

  const valid = referenceMeters.filter(
    (entry) =>
      entry.meter.unitId !== null && isValidIn(entry.meter, referencePeriod),
  );
  const validIds = new Set(valid.map((entry) => entry.meter.id));

  return [
    ...valid,
    ...referenceAffected.filter((entry) => !validIds.has(entry.meter.id)),
  ];
};

/**
 * Teilt einen Ersatzverbrauch auf mehrere betroffene Zähler: nach deren
 * Verbrauch im Vorjahr, wenn der für alle ordnungsgemäß vorliegt, sonst
 * gleichmäßig. Die Wohnungssumme hängt nicht von der Aufteilung ab.
 */
const splitAcrossMeters = (
  total: number,
  meters: ScopeMeter[],
  period: Period,
): number[] => {
  if (meters.length <= 1) {
    return [total];
  }

  const previousYear = {
    start: shiftIsoYears(period.start, -1),
    end: shiftIsoYears(period.end, -1),
  };
  const previous = meters.every((entry) =>
    isProperlyRecorded(entry, previousYear),
  )
    ? meters.map((entry) => fullPeriodConsumption(entry, previousYear))
    : null;
  const previousSum = previous?.reduce((acc, value) => acc + value, 0) ?? 0;

  if (previous && previousSum > 0) {
    return previous.map((value) => (total * value) / previousSum);
  }

  return meters.map(() => total / meters.length);
};

/**
 * Stand am Periodenanfang für den Ausgleich in späteren Perioden. Nur bei
 * fortlaufenden Zählern (ohne Stichtag) und verwertbarem Anfangsstand.
 */
const periodStartValueOf = (
  scopeMeter: ScopeMeter,
  period: Period,
): number | null => {
  if (scopeMeter.meter.resetDay || scopeMeter.readings.length === 0) {
    return null;
  }

  // Fehlt nach dem Anfang jede Ablesung (typisch im Ausfalljahr), rechnet
  // die Periode wie `consumptionBetween` mit dem letzten Stand davor.
  if (!scopeMeter.readings.some((reading) => reading.date <= period.start)) {
    return null;
  }

  return interpolateReading(scopeMeter.readings, period.start, {
    warnings: [],
  });
};

export type ConsumptionGap = {
  unitId: string;
  meterId: string;
  meterLabel: string;
  date: string;
  resolved: boolean;
  isSupplyBoundary?: boolean;
};

export type ScopeEvaluationInput = {
  scope: SubstitutionScope;
  period: Period;
  units: Array<{ id: string; name: string }>;
  /**
   * Grundkostenfläche je Wohnung im Maßstab des Bereichs
   */
  baseAreaByUnit: Map<string, number>;
  /**
   * Belegte Tage je Wohnung über die volle Periode (Hinweis auf Leerstand
   * bei Vergleichswohnungen)
   */
  fullOccupiedDaysByUnit?: Map<string, number>;
  /**
   * Wohnungszähler des Bereichs, Ausgleichsstände schon eingefügt
   */
  meters: ScopeMeter[];
  /**
   * HKV: Verfahren a über den Anteil am Gebäudeverbrauch. Sonst absolut.
   */
  shareMethod: boolean;
  substitutions: SubstitutionInput[];
  /**
   * Zähler des Bereichs mit Ablesungen der Vergleichszeiträume, auch
   * Vorgänger-Zähler
   */
  referenceMeters: ScopeMeter[];
  substitutedPeriods: SubstitutedPeriodMeters[];
  intervalWeight?: (fromDate: string, toDate: string) => number;
  /**
   * Versorgte Zeiträume je Wohnung im Bereich. Ohne Angabe sind alle
   * Wohnungen die ganze Periode versorgt.
   */
  supply?: UnitSupply;
};

export type ResolvedSubstitution = Omit<
  SubstitutionSnapshot,
  "appliedToDistribution"
> & {
  isValid: boolean;
};

export type ScopeEvaluation = {
  gaps: ConsumptionGap[];
  fullConsumptionByMeter: Map<string, number>;
  resolved: ResolvedSubstitution[];
  /**
   * Ersatzverbrauch je betroffenem Zähler über die volle Periode (bei HKV
   * gewichtet). Nur gültige Erfassungsausfälle.
   */
  substituteByMeter: Map<string, number>;
  affectedAreaSqm: number;
  totalAreaSqm: number;
  limitExceeded: boolean;
  warnings: CalcWarning[];
};

/**
 * § 9a Abs. 2: mehr als 25 % der Fläche betroffen. Auf ganze cm² gerundet,
 * damit Fließkomma die Grenze nicht verschiebt; genau 25 % reicht nicht.
 */
export const isSubstitutionLimitExceeded = (
  affectedAreaSqm: number,
  totalAreaSqm: number,
): boolean =>
  4 * Math.round(affectedAreaSqm * 10_000) > Math.round(totalAreaSqm * 10_000);

type Draft = {
  input: SubstitutionInput;
  unitName: string;
  affectedAreaSqm: number;
  affectedMeters: ScopeMeter[];
  basis: SubstitutionSnapshot["basis"];
  isValid: boolean;
  /**
   * Verfahren a mit Anteil: Anteil je betroffenem Zähler bzw. gesamt
   */
  shares?: number[];
  /**
   * Ersatzverbrauch je betroffenem Zähler
   */
  perMeter?: number[];
};

/**
 * Gemeinsame Daten der Auswertung eines Bereichs
 */
type ScopeContext = ScopeEvaluationInput & {
  warnings: CalcWarning[];
  unitName: (unitId: string) => string;
  fullConsumptionByMeter: Map<string, number>;
  gaps: ConsumptionGap[];
  /**
   * Wohnung liefert im Bereich einen verwertbaren gemessenen Verbrauch:
   * mindestens ein Zähler, keine offene Lücke, kein eigener
   * Erfassungsausfall. Ein gemessener Verbrauch von 0 ist verwertbar, eine
   * Wohnung ohne Zähler nicht.
   */
  hasUsableConsumption: (unitId: string) => boolean;
  unitConsumption: (unitId: string) => number;
};

const invalidate = (
  context: ScopeContext,
  draft: Draft,
  code: string,
  label?: string,
): void => {
  draft.isValid = false;
  context.warnings.push({
    code,
    params: {
      unit: draft.unitName,
      ...(label !== undefined ? { label } : {}),
    },
  });
};

/**
 * Verbrauch eines Zählers in den versorgten Zeiträumen seiner Wohnung, bei
 * HKV mit `kTotal` gewichtet. Stände außerhalb zählen nicht, auch wenn der
 * Zähler nach dem Ende der Versorgung weiterläuft.
 */
const suppliedConsumption = (
  scopeMeter: ScopeMeter,
  input: Pick<ScopeEvaluationInput, "period" | "supply" | "intervalWeight">,
): number =>
  sum(
    suppliedPeriodsOf(input.supply, scopeMeter.meter.unitId, input.period).map(
      (supplied) =>
        fullPeriodConsumption(
          {
            meter: scopeMeter.meter,
            readings: readingsForSuppliedPeriod(
              scopeMeter.readings,
              supplied,
              scopeMeter.meter.resetDay,
            ),
          },
          supplied,
          input.intervalWeight,
        ),
    ),
  );

/**
 * Misst jeden Zähler über die versorgten Zeiträume seiner Wohnung und
 * meldet fehlende Stichtagsstände, die kein Erfassungsausfall abdeckt
 */
const detectConsumptionGaps = (
  input: ScopeEvaluationInput,
  scopeSubstitutions: SubstitutionInput[],
  unitName: (unitId: string) => string,
  warnings: CalcWarning[],
): { gaps: ConsumptionGap[]; fullConsumptionByMeter: Map<string, number> } => {
  const { meters, period } = input;
  const coveredMeterIds = new Set(
    scopeSubstitutions.flatMap((entry) => entry.affectedMeterIds),
  );
  const fullConsumptionByMeter = new Map<string, number>();
  const gaps: ConsumptionGap[] = [];

  for (const scopeMeter of meters) {
    const { meter } = scopeMeter;
    fullConsumptionByMeter.set(
      meter.id,
      coveredMeterIds.has(meter.id)
        ? 0
        : suppliedConsumption(scopeMeter, input),
    );

    const missing = suppliedPeriodsOf(
      input.supply,
      meter.unitId,
      period,
    ).flatMap((supplied) =>
      missingSupplyReadings(scopeMeter.readings, supplied, meter.resetDay),
    );

    for (const { date, isSupplyBoundary } of missing) {
      const unitId = meter.unitId ?? "";
      const resolved =
        !isSupplyBoundary &&
        scopeSubstitutions.some(
          (entry) =>
            entry.unitId === unitId &&
            entry.affectedMeterIds.includes(meter.id),
        );
      gaps.push({
        unitId,
        meterId: meter.id,
        meterLabel: meter.label,
        date,
        resolved,
        ...(isSupplyBoundary ? { isSupplyBoundary } : {}),
      });

      if (!resolved) {
        warnings.push({
          code: isSupplyBoundary
            ? "supplyBoundaryReadingMissing"
            : "consumptionGap",
          params: {
            unit: unitName(unitId),
            date,
            label: meter.label,
            // Für die Verknüpfung in der Web-Oberfläche, nicht im Text
            unitId,
            meterId: meter.id,
            scope: input.scope,
          },
        });
      }
    }
  }

  return { gaps, fullConsumptionByMeter };
};

/**
 * Entwurf je Erfassungsausfall mit Fläche und betroffenen Zählern
 */
const createDraft = (
  context: ScopeContext,
  substitution: SubstitutionInput,
): Draft => {
  const name = context.unitName(substitution.unitId);
  const affectedMeters = substitution.affectedMeterIds
    .map((id) => context.meters.find((entry) => entry.meter.id === id))
    .filter((entry): entry is ScopeMeter => entry !== undefined);
  const draft: Draft = {
    input: substitution,
    unitName: name,
    affectedAreaSqm:
      substitution.affectedAreaSqm ??
      context.baseAreaByUnit.get(substitution.unitId) ??
      0,
    affectedMeters,
    basis: substitution.basisNote ? { basisNote: substitution.basisNote } : {},
    isValid: true,
  };

  const basisMissing =
    affectedMeters.length !== substitution.affectedMeterIds.length ||
    affectedMeters.some(
      (entry) => entry.meter.unitId !== substitution.unitId,
    ) ||
    !context.units.some((unit) => unit.id === substitution.unitId);
  if (basisMissing) {
    invalidate(context, draft, "substitutionBasisMissing");

    return draft;
  }

  const stillMissing = context.gaps.some(
    (gap) =>
      gap.unitId === substitution.unitId &&
      substitution.affectedMeterIds.includes(gap.meterId),
  );
  if (!stillMissing) {
    context.warnings.push({
      code: "substitutionDataNowComplete",
      params: { unit: name },
    });
  }

  return draft;
};

/**
 * Verfahren a, von Hand belegt: bei HKV Anteil, sonst absoluter Wert
 */
const resolveManualReference = (context: ScopeContext, draft: Draft): void => {
  const { input: substitution } = draft;
  const affected = substitution.manualAffectedConsumption ?? 0;
  draft.basis.referenceAffectedConsumption = affected;

  if (!context.shareMethod) {
    draft.perMeter = splitAcrossMeters(
      affected,
      draft.affectedMeters,
      context.period,
    );

    return;
  }

  const total = substitution.manualTotalConsumption ?? 0;
  draft.basis.referenceTotalConsumption = total;
  if (total <= 0) {
    invalidate(context, draft, "substitutionReferenceIncomplete");

    return;
  }
  draft.shares = [affected / total];
  draft.basis.referenceShare = affected / total;
};

/**
 * Verfahren a aus Zählerständen: dieselben (oder Vorgänger-)Zähler im
 * Vergleichszeitraum. HKV über den Anteil am Gebäudeverbrauch, WMZ und
 * Warmwasser absolut.
 */
const resolveMeterReference = (
  context: ScopeContext,
  draft: Draft,
  referencePeriod: Period,
): void => {
  const { input: substitution } = draft;
  const referenceIds =
    substitution.referenceMeterIds ?? substitution.affectedMeterIds;
  const referenceAffected = referenceIds
    .map((id) => context.referenceMeters.find((entry) => entry.meter.id === id))
    .filter((entry): entry is ScopeMeter => entry !== undefined);
  if (referenceAffected.length !== referenceIds.length) {
    invalidate(context, draft, "substitutionBasisMissing");

    return;
  }

  const checkedSet = referenceCheckSet(
    context.referenceMeters,
    referenceAffected,
    referencePeriod,
    context.shareMethod,
  );
  const substitutedInReference = substitutedMeterIdsIn(
    context.substitutedPeriods,
    referencePeriod,
  );
  const incomplete = checkedSet.find(
    (entry) =>
      substitutedInReference.has(entry.meter.id) ||
      !isProperlyRecorded(entry, referencePeriod),
  );
  if (incomplete) {
    invalidate(
      context,
      draft,
      "substitutionReferenceIncomplete",
      incomplete.meter.label,
    );

    return;
  }

  const referenceValues = referenceAffected.map((entry) =>
    fullPeriodConsumption(entry, referencePeriod),
  );
  const referenceAffectedSum = sum(referenceValues);
  draft.basis.referenceAffectedConsumption = referenceAffectedSum;
  const perMeterReference = substitution.referenceMeterIds === null;

  if (!context.shareMethod) {
    draft.perMeter = perMeterReference
      ? referenceValues
      : splitAcrossMeters(
          referenceAffectedSum,
          draft.affectedMeters,
          context.period,
        );

    return;
  }

  const total = sum(
    checkedSet.map((entry) => fullPeriodConsumption(entry, referencePeriod)),
  );
  draft.basis.referenceTotalConsumption = total;
  if (total <= 0) {
    invalidate(context, draft, "substitutionReferenceIncomplete");

    return;
  }
  draft.basis.referenceShare = referenceAffectedSum / total;
  draft.shares = perMeterReference
    ? referenceValues.map((value) => value / total)
    : [referenceAffectedSum / total];

  const currentIds = new Set(context.meters.map((entry) => entry.meter.id));
  const referenceSetIds = new Set(checkedSet.map((entry) => entry.meter.id));
  const setChanged =
    currentIds.size !== referenceSetIds.size ||
    [...currentIds].some((id) => !referenceSetIds.has(id));
  if (setChanged) {
    context.warnings.push({
      code: "substitutionMeterSetChanged",
      params: { unit: draft.unitName },
    });
  }
};

/**
 * Verfahren a: dieselben Räume, vergleichbarer Zeitraum
 */
const resolveSameRooms = (context: ScopeContext, draft: Draft): void => {
  const { input: substitution } = draft;
  const referencePeriod =
    substitution.referencePeriodStart && substitution.referencePeriodEnd
      ? {
          start: substitution.referencePeriodStart,
          end: substitution.referencePeriodEnd,
        }
      : null;
  if (!referencePeriod) {
    invalidate(context, draft, "substitutionReferenceIncomplete");

    return;
  }
  draft.basis.referencePeriod = referencePeriod;

  if (substitution.basisSource === "manual_reference") {
    resolveManualReference(context, draft);
  } else {
    resolveMeterReference(context, draft, referencePeriod);
  }
};

/**
 * Verfahren b und c aus Zählerständen: Verbrauch je m² der
 * Vergleichswohnungen bzw. des Gebäudes ohne gestörte Wohnungen
 */
const comparisonRate = (context: ScopeContext, draft: Draft): number | null => {
  const { input: substitution } = draft;
  const explicit = substitution.comparisonUnitIds;
  const referenceUnits =
    explicit ??
    context.units
      .map((unit) => unit.id)
      .filter(
        (unitId) =>
          unitId !== substitution.unitId &&
          context.hasUsableConsumption(unitId),
      );
  const invalid =
    (explicit !== null && explicit.length < 2) ||
    referenceUnits.length === 0 ||
    referenceUnits.some(
      (unitId) =>
        unitId === substitution.unitId ||
        !context.units.some((unit) => unit.id === unitId) ||
        !context.hasUsableConsumption(unitId),
    );
  const area = sum(
    referenceUnits.map((unitId) => context.baseAreaByUnit.get(unitId) ?? 0),
  );
  if (invalid || area <= 0) {
    return null;
  }

  const consumption = sum(referenceUnits.map(context.unitConsumption));
  draft.basis.comparisonUnitNames = referenceUnits.map(context.unitName);
  draft.basis.comparisonConsumption = consumption;
  draft.basis.comparisonAreaSqm = area;

  const periodDays = daysBetween(context.period.start, context.period.end);
  for (const unitId of referenceUnits) {
    const occupied = context.fullOccupiedDaysByUnit?.get(unitId);
    if (occupied !== undefined && occupied < periodDays) {
      context.warnings.push({
        code: "substitutionComparisonVacancy",
        params: { unit: draft.unitName, label: context.unitName(unitId) },
      });
    }
  }

  return consumption / area;
};

/**
 * Verfahren b und c: vergleichbare Räume bzw. Durchschnitt
 */
const resolveComparison = (context: ScopeContext, draft: Draft): void => {
  const { input: substitution } = draft;
  let rate: number | null;

  if (substitution.basisSource === "manual_reference") {
    const consumption = substitution.manualComparisonConsumption ?? 0;
    const area = substitution.manualComparisonAreaSqm ?? 0;
    draft.basis.comparisonConsumption = consumption;
    draft.basis.comparisonAreaSqm = area;
    rate = area > 0 ? consumption / area : null;
  } else {
    rate = comparisonRate(context, draft);
  }

  if (rate === null) {
    invalidate(context, draft, "substitutionComparisonInvalid");

    return;
  }

  draft.basis.ratePerSqm = rate;
  draft.perMeter = splitAcrossMeters(
    rate * draft.affectedAreaSqm,
    draft.affectedMeters,
    context.period,
  );
};

/**
 * Verfahren a mit Anteil: gemeinsamer Gebäudeverbrauch T, damit jeder
 * Ersatzwert im laufenden Zeitraum seinen Vergleichsanteil erhält:
 * `T = (M + Σ E_bc) / (1 − Σ p)`, `E_i = p_i × T`
 */
const applyShares = (context: ScopeContext, drafts: Draft[]): void => {
  const shareDrafts = drafts.filter(
    (draft) => draft.isValid && draft.shares !== undefined,
  );
  if (shareDrafts.length === 0) {
    return;
  }

  const validAffected = new Set(
    drafts
      .filter((draft) => draft.isValid)
      .flatMap((draft) => draft.input.affectedMeterIds),
  );
  const measured = sum(
    context.meters
      .filter((entry) => !validAffected.has(entry.meter.id))
      .map((entry) => context.fullConsumptionByMeter.get(entry.meter.id) ?? 0),
  );
  const otherSubstitutes = sum(
    drafts
      .filter((draft) => draft.isValid && draft.shares === undefined)
      .map((draft) => sum(draft.perMeter ?? [])),
  );
  const shareSum = sum(shareDrafts.map((draft) => sum(draft.shares ?? [])));

  if (shareSum >= 1) {
    for (const draft of shareDrafts) {
      invalidate(context, draft, "substitutionShareInvalid");
    }

    return;
  }

  const total = (measured + otherSubstitutes) / (1 - shareSum);
  for (const draft of shareDrafts) {
    const shares = draft.shares ?? [];
    draft.perMeter =
      shares.length === draft.affectedMeters.length
        ? shares.map((share) => share * total)
        : splitAcrossMeters(
            (shares[0] ?? 0) * total,
            draft.affectedMeters,
            context.period,
          );
  }
};

const toResolved = (
  context: ScopeContext,
  draft: Draft,
  substituteByMeter: Map<string, number>,
): ResolvedSubstitution => {
  const values = draft.isValid
    ? (draft.perMeter ?? draft.affectedMeters.map(() => 0))
    : draft.affectedMeters.map(() => 0);
  const perMeter = draft.affectedMeters.map((entry, index) => {
    const substituteConsumption = values[index] ?? 0;
    if (draft.isValid) {
      substituteByMeter.set(entry.meter.id, substituteConsumption);
    }

    return {
      meterId: entry.meter.id,
      meterLabel: entry.meter.label,
      periodStartValue: periodStartValueOf(entry, context.period),
      substituteConsumption,
    };
  });
  const { input: substitution } = draft;

  return {
    substitutionId: substitution.id,
    unitId: substitution.unitId,
    unitName: draft.unitName,
    scope: context.scope,
    reason: substitution.reason,
    ...(substitution.reasonNote ? { reasonNote: substitution.reasonNote } : {}),
    method: substitution.method,
    basisSource: substitution.basisSource,
    ...(substitution.meterKeptCounting !== null
      ? { meterKeptCounting: substitution.meterKeptCounting }
      : {}),
    affectedAreaSqm: draft.affectedAreaSqm,
    basis: draft.basis,
    perMeter,
    substituteConsumption: sum(
      perMeter.map((entry) => entry.substituteConsumption),
    ),
    isValid: draft.isValid,
  };
};

/**
 * Grenzt die Eingaben auf die zentrale Versorgung ein: Zähler nicht
 * versorgter Wohnungen entfallen, ebenso deren Erfassungsausfälle. Ein
 * Erfassungsausfall bei teilweise versorgter Wohnung wird in dieser
 * Version nicht gerechnet und blockiert.
 */
const restrictToSupply = (
  input: ScopeEvaluationInput,
  unitName: (unitId: string) => string,
  warnings: CalcWarning[],
): ScopeEvaluationInput => {
  if (!input.supply) {
    return input;
  }

  const stateOf = (unitId: string | null) =>
    supplyStateOf(input.supply, unitId ?? "", input.period);

  for (const entry of input.substitutions) {
    if (entry.scope === input.scope && stateOf(entry.unitId) === "partial") {
      warnings.push({
        code: "supplyChangeWithSubstitution",
        params: {
          unit: unitName(entry.unitId),
          unitId: entry.unitId,
          scope: input.scope,
        },
      });
    }
  }

  return {
    ...input,
    meters: input.meters.filter(
      (entry) => stateOf(entry.meter.unitId) !== "none",
    ),
    substitutions: input.substitutions.filter(
      (entry) => stateOf(entry.unitId) === "full",
    ),
  };
};

/**
 * Fläche des Bereichs für die 25-%-Grenze, nach versorgten Tagen gewichtet
 */
const suppliedTotalArea = (input: ScopeEvaluationInput): number => {
  const periodDays = daysBetween(input.period.start, input.period.end);

  return sum(
    input.units.map((unit) => {
      const area = input.baseAreaByUnit.get(unit.id) ?? 0;
      const supplied = input.supply?.get(unit.id);

      return supplied ? (area * daysOfPeriods(supplied)) / periodDays : area;
    }),
  );
};

/**
 * Ermittelt Lücken, Ersatzverbräuche und die 25-%-Grenze eines Bereichs
 */
export const evaluateSubstitutionScope = (
  rawInput: ScopeEvaluationInput,
): ScopeEvaluation => {
  const warnings: CalcWarning[] = [];
  const unitName = (unitId: string) =>
    rawInput.units.find((unit) => unit.id === unitId)?.name ?? unitId;
  const input = restrictToSupply(rawInput, unitName, warnings);
  const scopeSubstitutions = input.substitutions.filter(
    (entry) => entry.scope === input.scope,
  );
  const { gaps, fullConsumptionByMeter } = detectConsumptionGaps(
    input,
    scopeSubstitutions,
    unitName,
    warnings,
  );

  const unitsWithGap = new Set(gaps.map((gap) => gap.unitId));
  const meteredUnits = new Set(
    input.meters.map((entry) => entry.meter.unitId ?? ""),
  );
  const substitutedUnits = new Set(
    scopeSubstitutions.map((entry) => entry.unitId),
  );
  const context: ScopeContext = {
    ...input,
    warnings,
    unitName,
    fullConsumptionByMeter,
    gaps,
    // Nur ganzjährig versorgte Wohnungen taugen als Vergleich, sonst wäre
    // der Verbrauch je m² zu niedrig.
    hasUsableConsumption: (unitId) =>
      meteredUnits.has(unitId) &&
      !unitsWithGap.has(unitId) &&
      !substitutedUnits.has(unitId) &&
      supplyStateOf(input.supply, unitId, input.period) === "full",
    unitConsumption: (unitId) =>
      sum(
        input.meters
          .filter((entry) => entry.meter.unitId === unitId)
          .map((entry) => fullConsumptionByMeter.get(entry.meter.id) ?? 0),
      ),
  };

  const drafts = scopeSubstitutions.map((entry) => createDraft(context, entry));
  for (const draft of drafts.filter((entry) => entry.isValid)) {
    if (draft.input.method === "same_rooms_comparable_period") {
      resolveSameRooms(context, draft);
    }
  }
  for (const draft of drafts.filter((entry) => entry.isValid)) {
    if (draft.input.method !== "same_rooms_comparable_period") {
      resolveComparison(context, draft);
    }
  }
  applyShares(context, drafts);

  const substituteByMeter = new Map<string, number>();
  const resolved = drafts.map((draft) =>
    toResolved(context, draft, substituteByMeter),
  );
  const affectedAreaSqm = sum(drafts.map((draft) => draft.affectedAreaSqm));
  const totalAreaSqm = suppliedTotalArea(input);

  return {
    gaps,
    fullConsumptionByMeter,
    resolved,
    substituteByMeter,
    affectedAreaSqm,
    totalAreaSqm,
    limitExceeded:
      drafts.length > 0 &&
      isSubstitutionLimitExceeded(affectedAreaSqm, totalAreaSqm),
    warnings,
  };
};

/**
 * Ausgleichsstände eines Bereichs als Snapshot-Einträge, negative mit
 * blockierender Warnung
 */
export const compensationSnapshots = (
  scope: SubstitutionScope,
  meters: ScopeMeter[],
  compensations: CompensationInput[],
  period: Period,
  warnings: CalcWarning[],
): { snapshots: CompensationSnapshot[]; negativeMeterIds: Set<string> } => {
  const snapshots: CompensationSnapshot[] = [];
  const negativeMeterIds = new Set<string>();

  for (const scopeMeter of meters) {
    const relevant = relevantCompensations(
      scopeMeter,
      compensations.filter((entry) => entry.scope === scope),
      period,
    );

    for (const entry of relevant) {
      const { compensation, nextReading, resultingConsumption } = entry;
      if (entry.isNegative) {
        negativeMeterIds.add(scopeMeter.meter.id);
        warnings.push({
          code: "substitutionCompensationNegative",
          params: {
            label: scopeMeter.meter.label,
            date: nextReading?.date ?? period.end,
          },
        });
      }

      snapshots.push({
        meterId: scopeMeter.meter.id,
        meterLabel: scopeMeter.meter.label,
        unitId: scopeMeter.meter.unitId ?? "",
        scope,
        source: {
          period: compensation.sourcePeriod,
          substitutionId: compensation.substitutionId,
          method: compensation.method,
          reason: compensation.reason,
          ...(compensation.fromSnapshotOfStatementId
            ? {
                fromSnapshotOfStatementId:
                  compensation.fromSnapshotOfStatementId,
              }
            : {}),
        },
        periodStartValue: compensation.periodStartValue,
        substituteConsumption: compensation.substituteConsumption,
        compensationValue: compensationValue(compensation),
        nextReading: nextReading
          ? { date: nextReading.date, value: nextReading.value }
          : null,
        resultingConsumption,
      });
    }
  }

  return { snapshots, negativeMeterIds };
};

/**
 * Ausgleichsstände, die ein finalisierter oder live gerechneter
 * Erfassungsausfall für spätere Perioden erzeugt: nur fortlaufende Zähler,
 * nur wenn der Zähler weitergezählt hat und der Ersatzwert verteilt wurde.
 */
export const compensationsFromSubstitution = (
  substitution: Pick<
    SubstitutionSnapshot,
    | "substitutionId"
    | "scope"
    | "method"
    | "reason"
    | "meterKeptCounting"
    | "perMeter"
    | "appliedToDistribution"
  >,
  sourcePeriod: Period,
  fromSnapshotOfStatementId?: string,
): CompensationInput[] => {
  if (
    substitution.meterKeptCounting !== true ||
    !substitution.appliedToDistribution
  ) {
    return [];
  }

  return substitution.perMeter.flatMap((entry) =>
    entry.periodStartValue === null
      ? []
      : [
          {
            meterId: entry.meterId,
            scope: substitution.scope,
            sourcePeriod,
            substitutionId: substitution.substitutionId,
            method: substitution.method,
            reason: substitution.reason,
            periodStartValue: entry.periodStartValue,
            substituteConsumption: entry.substituteConsumption,
            ...(fromSnapshotOfStatementId ? { fromSnapshotOfStatementId } : {}),
          },
        ],
  );
};

/**
 * Entwertete Ablesungen, die ein Erfassungsausfall ohne Weiterzählen
 * erzeugt
 */
export const invalidationsFromSubstitution = (
  substitution: Pick<SubstitutionSnapshot, "meterKeptCounting" | "perMeter">,
  sourcePeriod: Period,
): ReadingInvalidation[] =>
  substitution.meterKeptCounting === false
    ? substitution.perMeter.map((entry) => ({
        meterId: entry.meterId,
        through: sourcePeriod.end,
      }))
    : [];

/**
 * Ob ein Vergleichszeitraum die technischen Voraussetzungen für Verfahren a
 * aus Zählerständen erfüllt: betroffene Zähler (bei HKV alle HKV des
 * Gebäudes) ordnungsgemäß erfasst und dort nicht selbst ersetzt. Ob der
 * Zeitraum fachlich vergleichbar ist, beurteilt der Nutzer.
 */
export const isReferencePeriodUsable = (params: {
  referencePeriod: Period;
  referenceMeterIds: string[];
  referenceMeters: ScopeMeter[];
  shareMethod: boolean;
  substitutedPeriods: SubstitutedPeriodMeters[];
}): boolean => {
  const { referencePeriod, referenceMeters } = params;
  const affected = params.referenceMeterIds.map((id) =>
    referenceMeters.find((entry) => entry.meter.id === id),
  );
  if (affected.some((entry) => entry === undefined)) {
    return false;
  }

  const substituted = substitutedMeterIdsIn(
    params.substitutedPeriods,
    referencePeriod,
  );
  const checked = referenceCheckSet(
    referenceMeters,
    affected as ScopeMeter[],
    referencePeriod,
    params.shareMethod,
  );

  return checked.every(
    (entry) =>
      !substituted.has(entry.meter.id) &&
      isProperlyRecorded(entry, referencePeriod),
  );
};
