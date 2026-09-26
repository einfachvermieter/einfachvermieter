import {
  type ConsumptionSubstitution,
  type ConsumptionSubstitutionWriteDto,
  formatNumber,
  normalizeNumberInput,
  type Period,
  type SubstitutionScope,
  shiftIsoYears,
} from "@einfachvermieter/shared";
import { useEffect, useState } from "react";
import { z } from "zod";
import { t } from "./i18n";
import type { SubstitutionOptions } from "./substitutions";

export type SubstitutionUnit = { id: string; name: string };

export type SubstitutionSheetTarget =
  | {
      kind: "new";
      units: SubstitutionUnit[];
      scopes: SubstitutionScope[];
      unitId?: string;
      scope?: SubstitutionScope;
      meterIds?: string[];
    }
  | {
      kind: "edit";
      units: SubstitutionUnit[];
      scopes: SubstitutionScope[];
      record: ConsumptionSubstitution;
    };

export type SubstitutionFormValues = {
  unitId: string;
  scope: SubstitutionScope;
  reason: string;
  reasonNote: string;
  affectedMeterIds: string[];
  meterKeptCounting: boolean;
  affectedAreaSqm: string;
  method: string;
  basisSource: string;
  referenceYears: string;
  useOtherReferenceMeters: boolean;
  referenceMeterIds: string[];
  useGroup: boolean;
  comparisonUnitIds: string[];
  manualAffectedConsumption: string;
  manualTotalConsumption: string;
  manualComparisonConsumption: string;
  manualComparisonAreaSqm: string;
  basisNote: string;
};

const required = () =>
  z.string().min(1, t("ui.substitutions.validation.required"));

/**
 * Nur Pflichtangaben im Browser; Verfahren und Grundlage prüft der Server
 */
export const substitutionFormSchema = z.object({
  unitId: required(),
  scope: z.enum(["heating", "hot_water"]),
  reason: required(),
  reasonNote: z.string(),
  affectedMeterIds: z.array(z.string()),
  meterKeptCounting: z.boolean(),
  affectedAreaSqm: z.string(),
  method: required(),
  basisSource: required(),
  referenceYears: z.string(),
  useOtherReferenceMeters: z.boolean(),
  referenceMeterIds: z.array(z.string()),
  useGroup: z.boolean(),
  comparisonUnitIds: z.array(z.string()),
  manualAffectedConsumption: z.string(),
  manualTotalConsumption: z.string(),
  manualComparisonConsumption: z.string(),
  manualComparisonAreaSqm: z.string(),
  basisNote: z.string(),
});

const parseNumber = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  const value = Number.parseFloat(normalizeNumberInput(trimmed));

  return Number.isFinite(value) ? value : null;
};

const numberInput = (value: number | null): string =>
  value === null ? "" : formatNumber(value, 2).replace(/\./gu, "");

const orNull = (raw: string): string | null =>
  raw.trim() === "" ? null : raw.trim();

const emptyValues = (
  target: Extract<SubstitutionSheetTarget, { kind: "new" }>,
): SubstitutionFormValues => ({
  unitId: target.unitId ?? "",
  scope: target.scope ?? "heating",
  reason: "",
  reasonNote: "",
  affectedMeterIds: target.meterIds ?? [],
  meterKeptCounting: true,
  affectedAreaSqm: "",
  method: "",
  basisSource: "meter_readings",
  referenceYears: "",
  useOtherReferenceMeters: false,
  referenceMeterIds: [],
  useGroup: false,
  comparisonUnitIds: [],
  manualAffectedConsumption: "",
  manualTotalConsumption: "",
  manualComparisonConsumption: "",
  manualComparisonAreaSqm: "",
  basisNote: "",
});

export const initialSubstitutionFormValues = (
  target: SubstitutionSheetTarget,
  period: Period,
): SubstitutionFormValues => {
  if (target.kind === "new") {
    return emptyValues(target);
  }

  const { record } = target;
  const referenceYears = record.referencePeriodStart
    ? Number(period.start.slice(0, 4)) -
      Number(record.referencePeriodStart.slice(0, 4))
    : null;

  return {
    unitId: record.unitId,
    scope: record.scope,
    reason: record.reason,
    reasonNote: record.reasonNote ?? "",
    affectedMeterIds: record.affectedMeterIds,
    meterKeptCounting: record.meterKeptCounting ?? true,
    affectedAreaSqm: numberInput(record.affectedAreaSqm),
    method: record.method,
    basisSource: record.basisSource,
    referenceYears: referenceYears === null ? "" : String(referenceYears),
    useOtherReferenceMeters: record.referenceMeterIds !== null,
    referenceMeterIds: record.referenceMeterIds ?? [],
    useGroup:
      record.method === "building_or_group_average" &&
      record.comparisonUnitIds !== null,
    comparisonUnitIds: record.comparisonUnitIds ?? [],
    manualAffectedConsumption: numberInput(record.manualAffectedConsumption),
    manualTotalConsumption: numberInput(record.manualTotalConsumption),
    manualComparisonConsumption: numberInput(
      record.manualComparisonConsumption,
    ),
    manualComparisonAreaSqm: numberInput(record.manualComparisonAreaSqm),
    basisNote: record.basisNote ?? "",
  };
};

/**
 * Ob alle Zähler der Wohnung im Bereich betroffen sind (dann gilt die
 * Fläche der ganzen Wohnung)
 */
export const isWholeUnit = (
  values: Pick<SubstitutionFormValues, "affectedMeterIds">,
  options: SubstitutionOptions | undefined,
): boolean =>
  options?.meters.every((meter) =>
    values.affectedMeterIds.includes(meter.id),
  ) === true;

/**
 * Felder des Verfahrens a (Vergleichszeitraum, von Hand belegte Werte)
 */
const sameRoomsFields = (
  values: SubstitutionFormValues,
  options: SubstitutionOptions | undefined,
  period: Period,
) => {
  const years = Number.parseInt(values.referenceYears, 10);
  const isManual = values.basisSource === "manual_reference";

  return {
    referencePeriodStart:
      years > 0 ? shiftIsoYears(period.start, -years) : null,
    referencePeriodEnd: years > 0 ? shiftIsoYears(period.end, -years) : null,
    referenceMeterIds:
      !isManual && values.useOtherReferenceMeters
        ? values.referenceMeterIds
        : null,
    manualAffectedConsumption: isManual
      ? parseNumber(values.manualAffectedConsumption)
      : null,
    manualTotalConsumption:
      isManual && options?.shareMethod
        ? parseNumber(values.manualTotalConsumption)
        : null,
  };
};

/**
 * Felder der Verfahren b und c (Vergleichswohnungen, von Hand belegter
 * Vergleich)
 */
const comparisonFields = (values: SubstitutionFormValues) => {
  const isManual = values.basisSource === "manual_reference";
  const usesUnits =
    values.method === "comparable_rooms" ||
    (values.method === "building_or_group_average" && values.useGroup);

  return {
    comparisonUnitIds: !isManual && usesUnits ? values.comparisonUnitIds : null,
    manualComparisonConsumption: isManual
      ? parseNumber(values.manualComparisonConsumption)
      : null,
    manualComparisonAreaSqm: isManual
      ? parseNumber(values.manualComparisonAreaSqm)
      : null,
  };
};

const emptyMethodFields = {
  referencePeriodStart: null,
  referencePeriodEnd: null,
  referenceMeterIds: null,
  comparisonUnitIds: null,
  manualAffectedConsumption: null,
  manualTotalConsumption: null,
  manualComparisonConsumption: null,
  manualComparisonAreaSqm: null,
};

/**
 * Formular in den API-DTO. Felder, die nicht zu Verfahren und Grundlage
 * gehören, werden null; die Prüfung übernimmt der Server.
 */
export const substitutionFormToDto = (
  values: SubstitutionFormValues,
  options: SubstitutionOptions | undefined,
  period: Period,
): ConsumptionSubstitutionWriteDto => {
  const selected = (options?.meters ?? []).filter((meter) =>
    values.affectedMeterIds.includes(meter.id),
  );
  const isSameRooms = values.method === "same_rooms_comparable_period";

  return {
    unitId: values.unitId,
    periodStart: period.start,
    periodEnd: period.end,
    scope: values.scope,
    reason: values.reason as ConsumptionSubstitutionWriteDto["reason"],
    reasonNote: values.reason === "other" ? orNull(values.reasonNote) : null,
    affectedMeterIds: values.affectedMeterIds,
    meterKeptCounting: selected.some((meter) => meter.isContinuous)
      ? values.meterKeptCounting
      : null,
    affectedAreaSqm:
      values.scope === "heating" && !isWholeUnit(values, options)
        ? parseNumber(values.affectedAreaSqm)
        : null,
    method: values.method as ConsumptionSubstitutionWriteDto["method"],
    basisSource:
      values.basisSource as ConsumptionSubstitutionWriteDto["basisSource"],
    ...emptyMethodFields,
    ...(isSameRooms
      ? sameRoomsFields(values, options, period)
      : comparisonFields(values)),
    basisNote:
      values.basisSource === "manual_reference"
        ? orNull(values.basisNote)
        : null,
  };
};

/**
 * Wert, der sich erst nach einer kurzen Eingabepause ändert
 */
export const useDebounced = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
