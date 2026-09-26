import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { wholeYearsBefore } from "../date.js";
import { isoDate } from "./common.js";

/**
 * Bereich eines Erfassungsausfalls nach § 9a HeizkostenV
 */
export const substitutionScopes = ["heating", "hot_water"] as const;
export type SubstitutionScope = (typeof substitutionScopes)[number];

/**
 * Ursache eines Erfassungsausfalls
 */
export const substitutionReasons = [
  "device_failure",
  "reading_missed",
  "reading_not_possible",
  "implausible_value",
  "other",
] as const;
export type SubstitutionReason = (typeof substitutionReasons)[number];

/**
 * Die drei Ersatzverfahren aus § 9a Abs. 1 HeizkostenV
 */
export const substitutionMethods = [
  "same_rooms_comparable_period",
  "comparable_rooms",
  "building_or_group_average",
] as const;
export type SubstitutionMethod = (typeof substitutionMethods)[number];

/**
 * Herkunft der Datengrundlage: aus den Zählerständen der App oder von Hand
 * belegt (z.B. aus einer früheren Messdienst-Abrechnung)
 */
export const substitutionBasisSources = [
  "meter_readings",
  "manual_reference",
] as const;
export type SubstitutionBasisSource = (typeof substitutionBasisSources)[number];

/**
 * Erfassungsausfall nach § 9a HeizkostenV für eine Wohnung, einen Bereich
 * und eine Abrechnungsperiode. Der Ersatzverbrauch wird nicht gespeichert,
 * sondern aus der Grundlage gerechnet.
 */
export type ConsumptionSubstitution = {
  id: string;
  buildingId: string;
  unitId: string;
  periodStart: string;
  periodEnd: string;
  scope: SubstitutionScope;
  reason: SubstitutionReason;
  reasonNote: string | null;
  affectedMeterIds: string[];
  meterKeptCounting: boolean | null;
  affectedAreaSqm: number | null;
  method: SubstitutionMethod;
  basisSource: SubstitutionBasisSource;
  referencePeriodStart: string | null;
  referencePeriodEnd: string | null;
  referenceMeterIds: string[] | null;
  comparisonUnitIds: string[] | null;
  manualAffectedConsumption: number | null;
  manualTotalConsumption: number | null;
  manualComparisonConsumption: number | null;
  manualComparisonAreaSqm: number | null;
  basisNote: string | null;
  decidedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

const note = () => z.string().trim().max(2000).nullable();

const writeObjectSchema = z
  .object({
    unitId: z.string().min(1),
    periodStart: isoDate(),
    periodEnd: isoDate(),
    scope: z.enum(substitutionScopes),
    reason: z.enum(substitutionReasons),
    reasonNote: note(),
    affectedMeterIds: z.array(z.string().min(1)).min(1),
    meterKeptCounting: z.boolean().nullable(),
    affectedAreaSqm: z.number().positive().max(100_000).nullable(),
    method: z.enum(substitutionMethods),
    basisSource: z.enum(substitutionBasisSources),
    referencePeriodStart: isoDate().nullable(),
    referencePeriodEnd: isoDate().nullable(),
    referenceMeterIds: z.array(z.string().min(1)).min(1).nullable(),
    comparisonUnitIds: z.array(z.string().min(1)).nullable(),
    manualAffectedConsumption: z.number().nonnegative().nullable(),
    manualTotalConsumption: z.number().positive().nullable(),
    manualComparisonConsumption: z.number().nonnegative().nullable(),
    manualComparisonAreaSqm: z.number().positive().nullable(),
    basisNote: note(),
  })
  .strict();

type WriteValue = z.infer<typeof writeObjectSchema>;

type Report = (path: keyof WriteValue, key: string) => void;

const requireEmpty = (
  value: WriteValue,
  report: Report,
  paths: Array<keyof WriteValue>,
): void => {
  for (const path of paths) {
    if (value[path] !== null) {
      report(path, "notApplicable");
    }
  }
};

/**
 * Verfahren a: Vergleichszeitraum um ganze Jahre zurück, Felder je
 * Datengrundlage
 */
const checkSameRooms = (value: WriteValue, report: Report): void => {
  requireEmpty(value, report, [
    "comparisonUnitIds",
    "manualComparisonConsumption",
    "manualComparisonAreaSqm",
  ]);

  if (
    value.referencePeriodStart === null ||
    value.referencePeriodEnd === null
  ) {
    report("referencePeriodStart", "referencePeriodRequired");
  } else if (
    wholeYearsBefore(
      { start: value.periodStart, end: value.periodEnd },
      { start: value.referencePeriodStart, end: value.referencePeriodEnd },
    ) === null
  ) {
    report("referencePeriodStart", "referencePeriodShift");
  }

  if (value.basisSource === "meter_readings") {
    requireEmpty(value, report, [
      "manualAffectedConsumption",
      "manualTotalConsumption",
    ]);

    return;
  }

  requireEmpty(value, report, ["referenceMeterIds"]);
  if (value.manualAffectedConsumption === null) {
    report("manualAffectedConsumption", "required");
  } else if (
    value.manualTotalConsumption !== null &&
    value.manualAffectedConsumption >= value.manualTotalConsumption
  ) {
    report("manualAffectedConsumption", "affectedBelowTotal");
  }
};

/**
 * Verfahren b und c: Vergleichswohnungen oder von Hand belegter Vergleich
 */
const checkComparison = (value: WriteValue, report: Report): void => {
  requireEmpty(value, report, [
    "referencePeriodStart",
    "referencePeriodEnd",
    "referenceMeterIds",
    "manualAffectedConsumption",
    "manualTotalConsumption",
  ]);

  if (value.basisSource === "manual_reference") {
    requireEmpty(value, report, ["comparisonUnitIds"]);
    if (value.manualComparisonConsumption === null) {
      report("manualComparisonConsumption", "required");
    }
    if (value.manualComparisonAreaSqm === null) {
      report("manualComparisonAreaSqm", "required");
    }

    return;
  }

  requireEmpty(value, report, [
    "manualComparisonConsumption",
    "manualComparisonAreaSqm",
  ]);

  const comparison = value.comparisonUnitIds;
  if (comparison?.includes(value.unitId)) {
    report("comparisonUnitIds", "comparisonIncludesOwnUnit");
  }

  const needsList = value.method === "comparable_rooms";
  if ((needsList || comparison !== null) && (comparison?.length ?? 0) < 2) {
    report("comparisonUnitIds", "comparisonTooFew");
  }
};

/**
 * Prüfungen, die ohne Datenbank möglich sind. Zugehörigkeit von Wohnung
 * und Zählern, Messart und Sperre prüft der Server.
 */
export const consumptionSubstitutionWriteSchema = writeObjectSchema.superRefine(
  (value, ctx) => {
    const report: Report = (path, key) =>
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: messageKey(`ui.substitutions.validation.${key}`),
      });

    if (value.periodEnd < value.periodStart) {
      report("periodEnd", "periodRange");
    }

    if (value.reason === "other" && !value.reasonNote) {
      report("reasonNote", "reasonNoteRequired");
    }

    if (value.scope === "hot_water") {
      requireEmpty(value, report, ["affectedAreaSqm"]);
    }

    if (value.basisSource === "manual_reference" && !value.basisNote) {
      report("basisNote", "basisNoteRequired");
    }

    if (value.method === "same_rooms_comparable_period") {
      checkSameRooms(value, report);
    } else {
      checkComparison(value, report);
    }
  },
);

export type ConsumptionSubstitutionWriteDto = z.infer<
  typeof consumptionSubstitutionWriteSchema
>;
