import { describe, expect, it } from "vitest";
import {
  type ConsumptionSubstitutionWriteDto,
  consumptionSubstitutionWriteSchema,
} from "./consumption-substitutions.js";

const base: ConsumptionSubstitutionWriteDto = {
  unitId: "unit-a",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  scope: "heating",
  reason: "reading_missed",
  reasonNote: null,
  affectedMeterIds: ["meter-a"],
  meterKeptCounting: true,
  affectedAreaSqm: null,
  method: "same_rooms_comparable_period",
  basisSource: "meter_readings",
  referencePeriodStart: "2024-01-01",
  referencePeriodEnd: "2024-12-31",
  referenceMeterIds: null,
  comparisonUnitIds: null,
  manualAffectedConsumption: null,
  manualTotalConsumption: null,
  manualComparisonConsumption: null,
  manualComparisonAreaSqm: null,
  basisNote: null,
};

const errorPaths = (value: ConsumptionSubstitutionWriteDto) => {
  const result = consumptionSubstitutionWriteSchema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path[0]);
};

describe("consumptionSubstitutionWriteSchema", () => {
  it("akzeptiert Verfahren a mit einem um ganze Jahre verschobenen Zeitraum", () => {
    expect(errorPaths(base)).toEqual([]);
  });

  it("verlangt einen um ganze Jahre verschobenen Vergleichszeitraum", () => {
    expect(
      errorPaths({ ...base, referencePeriodStart: "2025-02-01" }),
    ).toContain("referencePeriodStart");
    expect(
      errorPaths({
        ...base,
        referencePeriodStart: null,
        referencePeriodEnd: null,
      }),
    ).toContain("referencePeriodStart");
  });

  it("kennt kein viertes Verfahren; von Hand nur mit Herkunft", () => {
    expect(
      consumptionSubstitutionWriteSchema.safeParse({
        ...base,
        method: "manual",
      }).success,
    ).toBe(false);
    expect(
      errorPaths({
        ...base,
        basisSource: "manual_reference",
        manualAffectedConsumption: 5000,
      }),
    ).toContain("basisNote");
    expect(
      errorPaths({
        ...base,
        basisSource: "manual_reference",
        manualAffectedConsumption: 500,
        manualTotalConsumption: 400,
        basisNote: "Messdienst 2024",
      }),
    ).toContain("manualAffectedConsumption");
  });

  it("verlangt mindestens zwei Vergleichswohnungen ohne die eigene", () => {
    const comparison = {
      ...base,
      method: "comparable_rooms" as const,
      referencePeriodStart: null,
      referencePeriodEnd: null,
    };
    expect(
      errorPaths({ ...comparison, comparisonUnitIds: ["unit-b"] }),
    ).toContain("comparisonUnitIds");
    expect(
      errorPaths({ ...comparison, comparisonUnitIds: ["unit-a", "unit-b"] }),
    ).toContain("comparisonUnitIds");
    expect(
      errorPaths({ ...comparison, comparisonUnitIds: ["unit-b", "unit-c"] }),
    ).toEqual([]);
  });

  it("lässt beim Warmwasser keine Teilfläche zu", () => {
    expect(
      errorPaths({ ...base, scope: "hot_water", affectedAreaSqm: 20 }),
    ).toContain("affectedAreaSqm");
  });

  it("verlangt eine Notiz bei sonstiger Ursache", () => {
    expect(errorPaths({ ...base, reason: "other" })).toContain("reasonNote");
  });
});
