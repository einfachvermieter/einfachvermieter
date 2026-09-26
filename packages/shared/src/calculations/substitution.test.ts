import { describe, expect, it } from "vitest";
import type { MeterInfo, ReadingPoint, UnitInfo } from "../types/index.js";
import { hasBlockingWarning } from "./diagnostics.js";
import { calculateHeating } from "./heating.js";
import { classifyPeriodBoundaries } from "./meters.js";
import {
  type CompensationInput,
  compensationsFromSubstitution,
  invalidationsFromSubstitution,
  isReferencePeriodUsable,
  isSubstitutionLimitExceeded,
  type ScopeMeter,
  type SubstitutionInput,
} from "./substitution.js";

const reading = (
  date: string,
  value: number,
  isEstimated = false,
): ReadingPoint => ({ date, value, isCumulative: true, isEstimated });

const unit = (id: string, areaSqm: number, periodDays = 365): UnitInfo => ({
  id,
  name: id,
  areaSqm,
  occupantCount: 1,
  personDays: periodDays,
  occupiedDays: periodDays,
  periodDays,
});

const meter = (
  id: string,
  unitId: string,
  type: MeterInfo["type"],
  resetDay: string | null = null,
): MeterInfo => ({
  id,
  type,
  role: "unit",
  unitId,
  label: id,
  measurementUnit: type === "heat_cost_allocator" ? "units" : "kwh",
  kTotal: type === "heat_cost_allocator" ? 1 : null,
  validFrom: "1900-01-01",
  validUntil: null,
  resetDay,
});

const substitution = (
  overrides: Partial<SubstitutionInput> &
    Pick<SubstitutionInput, "id" | "unitId" | "affectedMeterIds">,
): SubstitutionInput => ({
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  scope: "heating",
  reason: "reading_not_possible",
  reasonNote: null,
  meterKeptCounting: null,
  affectedAreaSqm: null,
  method: "building_or_group_average",
  basisSource: "meter_readings",
  referencePeriodStart: null,
  referencePeriodEnd: null,
  referenceMeterIds: null,
  comparisonUnitIds: null,
  manualAffectedConsumption: null,
  manualTotalConsumption: null,
  manualComparisonConsumption: null,
  manualComparisonAreaSqm: null,
  basisNote: null,
  ...overrides,
});

const codes = (warnings: Array<{ code: string }> | undefined) =>
  (warnings ?? []).map((warning) => warning.code);

describe("classifyPeriodBoundaries", () => {
  it("unterscheidet echte, geschätzte, interpolierte und fehlende Stände", () => {
    const readings = [
      reading("2025-12-31", 100),
      reading("2026-06-30", 150, true),
      reading("2027-06-30", 300),
    ];

    expect(
      classifyPeriodBoundaries(
        [reading("2026-01-01", 0), reading("2026-12-31", 10)],
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual({ start: "read", end: "read" });
    // Anfang zwischen 31.12. und einer geschätzten Stützstelle, Ende
    // zwischen der geschätzten und einer echten Ablesung
    expect(
      classifyPeriodBoundaries(readings, "2026-01-01", "2026-12-31"),
    ).toEqual({ start: "estimated", end: "estimated" });
    // Interpoliert auch über einen langen Abstand, ohne Zeitgrenze
    expect(
      classifyPeriodBoundaries(
        [reading("2025-01-01", 0), reading("2027-06-30", 300)],
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual({ start: "interpolated", end: "interpolated" });
    expect(
      classifyPeriodBoundaries(
        [reading("2026-01-01", 0)],
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual({ start: "read", end: "missing" });
    expect(classifyPeriodBoundaries([], "2026-01-01", "2026-12-31")).toEqual({
      start: "missing",
      end: "missing",
    });
  });

  it("wertet den Nullstand nach einem Stichtag als echte Ablesung", () => {
    // Stichtag 30.06.: der letzte Abschnitt beginnt am 01.07. bei 0.
    expect(
      classifyPeriodBoundaries(
        [
          reading("2026-01-01", 500),
          reading("2026-06-30", 800),
          reading("2026-12-31", 400),
        ],
        "2026-01-01",
        "2026-12-31",
        "06-30",
      ),
    ).toEqual({ start: "read", end: "read" });
  });
});

describe("isSubstitutionLimitExceeded (§ 9a Abs. 2)", () => {
  it("greift erst über 25 %", () => {
    expect(isSubstitutionLimitExceeded(80, 320)).toBe(false);
    expect(isSubstitutionLimitExceeded(80.01, 320)).toBe(true);
    // Fließkomma: 62,6 / 250,4 ist genau 25 %.
    expect(isSubstitutionLimitExceeded(62.6, 250.4)).toBe(false);
  });
});

/**
 * Rechenbeispiel der Spezifikation: vier Wohnungen, HKV, W1 mit
 * ausgefallenem HKV 3 in einem Raum mit 20 m².
 */
describe("§ 9a: Teilausfall eines HKV", () => {
  const units = [
    unit("W1", 80),
    unit("W2", 80),
    unit("W3", 60),
    unit("W4", 100),
  ];
  const hkv = (
    id: string,
    unitId: string,
    ref: number,
    current: number | null,
  ) => ({
    meter: meter(id, unitId, "heat_cost_allocator"),
    readings: [
      reading("2025-01-01", 0),
      reading("2025-12-31", ref),
      reading("2026-01-01", 0),
      ...(current === null ? [] : [reading("2026-12-31", current)]),
    ],
  });
  // Vergleichsjahr 2025: HKV 3 hatte 240 von 3.000 Einheiten (8 %).
  const meters = (overrides: Record<string, number | null> = {}) => [
    hkv("HKV1", "W1", 300, 300),
    hkv("HKV2", "W1", 200, 200),
    hkv("HKV3", "W1", 240, null),
    hkv("W2-HKV", "W2", 900, 800),
    hkv(
      "W3-HKV",
      "W3",
      460,
      "W3-HKV" in overrides ? (overrides["W3-HKV"] ?? null) : 500,
    ),
    hkv(
      "W4-HKV",
      "W4",
      900,
      "W4-HKV" in overrides ? (overrides["W4-HKV"] ?? null) : 1000,
    ),
  ];
  const withoutResetMeters = (list: ReturnType<typeof meters>) =>
    list.map((entry) => ({
      meter: entry.meter,
      // Die Vergleichsablesungen haben ihren eigenen Abschnitt; im
      // laufenden Zeitraum zählt der HKV ab 01.01.2026 neu.
      readings: entry.readings.filter((point) => point.date >= "2026-01-01"),
    }));

  const input = (
    substitutions: SubstitutionInput[],
    overrides: Record<string, number | null> = {},
  ) => {
    const all = meters(overrides);
    return {
      totalHeatingCostsCents: 100_000,
      config: { consumptionShareBps: 7000 },
      units,
      consumptionMethod: "heat_cost_allocator" as const,
      consumptionMeters: withoutResetMeters(all),
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      targetUnitId: "W1",
      substitutions,
      referenceMeters: { heating: all },
    };
  };
  const hkv3 = (overrides: Partial<SubstitutionInput>) =>
    substitution({
      id: "s-w1",
      unitId: "W1",
      affectedMeterIds: ["HKV3"],
      affectedAreaSqm: 20,
      ...overrides,
    });
  const w1 = (result: ReturnType<typeof calculateHeating>) =>
    result.perUnit.find((row) => row.unitId === "W1");

  it("Verfahren a: Vorjahresanteil 8 % des Gebäudeverbrauchs", () => {
    const result = calculateHeating(
      input([
        hkv3({
          method: "same_rooms_comparable_period",
          referencePeriodStart: "2025-01-01",
          referencePeriodEnd: "2025-12-31",
        }),
      ]),
    );

    const substituted = result.substitutions?.[0];
    expect(substituted?.basis.referenceShare).toBeCloseTo(0.08, 10);
    expect(substituted?.substituteConsumption).toBeCloseTo(
      (0.08 * 2800) / 0.92,
      6,
    );
    // HKV 1 und 2 bleiben gemessen.
    expect(w1(result)?.consumptionKwh).toBeCloseTo(
      500 + (0.08 * 2800) / 0.92,
      6,
    );
    expect(w1(result)?.consumptionIsSubstituted).toBe(true);
    const total = result.perUnit.reduce(
      (acc, row) => acc + row.consumptionKwh,
      0,
    );
    expect((substituted?.substituteConsumption ?? 0) / total).toBeCloseTo(
      0.08,
      10,
    );
    expect(result.substitutionArea?.heating).toEqual({
      affectedAreaSqm: 20,
      totalAreaSqm: 320,
      limitExceeded: false,
    });
    expect(codes(result.warnings)).toContain("substitutionHeatingSameRooms");
    expect(hasBlockingWarning({ heatingDetail: result })).toBe(false);
  });

  it("Verfahren b: vergleichbare Wohnungen W2 und W4", () => {
    const result = calculateHeating(
      input([
        hkv3({ method: "comparable_rooms", comparisonUnitIds: ["W2", "W4"] }),
      ]),
    );

    expect(result.substitutions?.[0]?.basis.ratePerSqm).toBeCloseTo(10, 10);
    expect(w1(result)?.consumptionKwh).toBeCloseTo(700, 6);
    expect(codes(result.warnings)).toContain(
      "substitutionHeatingComparableRooms",
    );
  });

  it("Verfahren c: Gebäudedurchschnitt ohne die betroffene Wohnung", () => {
    const result = calculateHeating(input([hkv3({})]));

    expect(result.substitutions?.[0]?.basis.comparisonUnitNames).toEqual([
      "W2",
      "W3",
      "W4",
    ]);
    expect(w1(result)?.consumptionKwh).toBeCloseTo(500 + (2300 / 240) * 20, 6);
    expect(codes(result.warnings)).toContain(
      "substitutionHeatingBuildingAverage",
    );
  });

  it("b und c liefern bei gleicher Referenzmenge denselben Wert", () => {
    const group = calculateHeating(
      input([hkv3({ comparisonUnitIds: ["W2", "W3", "W4"] })]),
    );
    const building = calculateHeating(input([hkv3({})]));

    expect(group.substitutions?.[0]?.substituteConsumption).toBeCloseTo(
      building.substitutions?.[0]?.substituteConsumption ?? 0,
      10,
    );
    expect(codes(group.warnings)).toContain("substitutionHeatingGroupAverage");
  });

  it("verteilt den Topf centgenau", () => {
    const result = calculateHeating(input([hkv3({})]));
    const sum =
      result.perUnit.reduce((acc, row) => acc + row.totalCents, 0) +
      (result.landlordBasicCostCents ?? 0) +
      (result.landlordConsumptionCostCents ?? 0);

    expect(sum).toBe(100_000);
  });

  it("über 25 % (weiterer Ausfall W4) wird nach § 9a Abs. 2 nach Fläche verteilt", () => {
    const result = calculateHeating({
      ...input(
        [
          hkv3({}),
          substitution({
            id: "s-w4",
            unitId: "W4",
            affectedMeterIds: ["W4-HKV"],
            method: "comparable_rooms",
            comparisonUnitIds: ["W2", "W3"],
          }),
        ],
        { "W4-HKV": null },
      ),
      targetUnitId: "W2",
    });

    expect(result.substitutionArea?.heating).toEqual({
      affectedAreaSqm: 120,
      totalAreaSqm: 320,
      limitExceeded: true,
    });
    expect(result.consumptionDistributionMethod).toBe("heating_area");
    expect(result.areaDistributionReason).toBe("substitution_limit_exceeded");
    expect(
      result.substitutions?.every((entry) => !entry.appliedToDistribution),
    ).toBe(true);
    // Verbrauchsanteil 70.000 nach Heizfläche: W2 80 / 320
    expect(
      result.perUnit.find((row) => row.unitId === "W2")?.consumptionCostCents,
    ).toBe(17_500);
    const warningCodes = codes(result.warnings);
    expect(warningCodes).toContain("substitutionAreaDistributionHeating");
    expect(
      warningCodes.some((code) => code.startsWith("consumptionFallback")),
    ).toBe(false);
    expect(warningCodes).not.toContain("substitutionOtherUnitsHeating");
  });

  it("genau 25 % (HKV 3 und ganze W3) bleibt bei Abs. 1", () => {
    const result = calculateHeating(
      input(
        [
          hkv3({ method: "comparable_rooms", comparisonUnitIds: ["W2", "W4"] }),
          substitution({
            id: "s-w3",
            unitId: "W3",
            affectedMeterIds: ["W3-HKV"],
            method: "comparable_rooms",
            comparisonUnitIds: ["W2", "W4"],
          }),
        ],
        { "W3-HKV": null },
      ),
    );

    expect(result.substitutionArea?.heating?.affectedAreaSqm).toBe(80);
    expect(result.substitutionArea?.heating?.limitExceeded).toBe(false);
    expect(result.consumptionDistributionMethod).toBe("consumption");
  });

  it("meldet eine offene Lücke blockierend", () => {
    const result = calculateHeating(input([]));

    expect(codes(result.warnings)).toContain("consumptionGap");
    expect(hasBlockingWarning({ heatingDetail: result })).toBe(true);
  });

  it("ungültige Grundlagen blockieren", () => {
    const onlyOne = calculateHeating(
      input([hkv3({ method: "comparable_rooms", comparisonUnitIds: ["W2"] })]),
    );
    expect(codes(onlyOne.warnings)).toContain("substitutionComparisonInvalid");

    const sharesTooHigh = calculateHeating(
      input(
        [
          hkv3({
            method: "same_rooms_comparable_period",
            basisSource: "manual_reference",
            referencePeriodStart: "2025-01-01",
            referencePeriodEnd: "2025-12-31",
            manualAffectedConsumption: 600,
            manualTotalConsumption: 1000,
            basisNote: "Messdienst",
          }),
          substitution({
            id: "s-w3",
            unitId: "W3",
            affectedMeterIds: ["W3-HKV"],
            method: "same_rooms_comparable_period",
            basisSource: "manual_reference",
            referencePeriodStart: "2025-01-01",
            referencePeriodEnd: "2025-12-31",
            manualAffectedConsumption: 500,
            manualTotalConsumption: 1000,
            basisNote: "Messdienst",
          }),
        ],
        { "W3-HKV": null },
      ),
    );
    expect(codes(sharesTooHigh.warnings)).toContain("substitutionShareInvalid");

    const substitutedReference = calculateHeating({
      ...input([
        hkv3({
          method: "same_rooms_comparable_period",
          referencePeriodStart: "2025-01-01",
          referencePeriodEnd: "2025-12-31",
        }),
      ]),
      substitutedPeriods: [
        {
          period: { start: "2025-01-01", end: "2025-12-31" },
          meterIds: ["HKV3"],
        },
      ],
    });
    expect(codes(substitutedReference.warnings)).toContain(
      "substitutionReferenceIncomplete",
    );
    expect(hasBlockingWarning({ heatingDetail: substitutedReference })).toBe(
      true,
    );
  });

  it("ein Vergleichszeitraum vor dem Einbau der Zähler ist unvollständig", () => {
    const all = meters().map((entry) => ({
      ...entry,
      meter: { ...entry.meter, validFrom: "2025-01-01" },
    }));
    const result = calculateHeating({
      ...input([
        hkv3({
          method: "same_rooms_comparable_period",
          referencePeriodStart: "2024-01-01",
          referencePeriodEnd: "2024-12-31",
        }),
      ]),
      referenceMeters: { heating: all },
    });

    expect(codes(result.warnings)).toContain("substitutionReferenceIncomplete");
    expect(
      isReferencePeriodUsable({
        referencePeriod: { start: "2024-01-01", end: "2024-12-31" },
        referenceMeterIds: ["HKV3"],
        referenceMeters: all,
        shareMethod: true,
        substitutedPeriods: [],
      }),
    ).toBe(false);
    expect(
      isReferencePeriodUsable({
        referencePeriod: { start: "2025-01-01", end: "2025-12-31" },
        referenceMeterIds: ["HKV3"],
        referenceMeters: all,
        shareMethod: true,
        substitutedPeriods: [],
      }),
    ).toBe(true);
  });

  it("Vergleichswohnung mit eigenem Ausfall taugt nicht", () => {
    const result = calculateHeating(
      input(
        [
          hkv3({}),
          substitution({
            id: "s-w4",
            unitId: "W4",
            affectedMeterIds: ["W4-HKV"],
            method: "comparable_rooms",
            comparisonUnitIds: ["W1", "W2"],
          }),
        ],
        { "W4-HKV": null },
      ),
    );

    expect(codes(result.warnings)).toContain("substitutionComparisonInvalid");
  });

  it("ein geschätzter Stand allein ist kein § 9a-Fall", () => {
    const all = meters();
    const consumptionMeters = withoutResetMeters(all).map((entry) =>
      entry.meter.id === "HKV3"
        ? {
            ...entry,
            readings: [...entry.readings, reading("2026-12-31", 250, true)],
          }
        : entry,
    );
    const result = calculateHeating({ ...input([]), consumptionMeters });

    expect(codes(result.warnings)).toContain("readingEstimated");
    expect(codes(result.warnings)).not.toContain("consumptionGap");
    expect(result.substitutions).toBeUndefined();
    expect(result.substitutionArea).toBeUndefined();
  });
});

/**
 * Drei-Jahres-Beispiel der Spezifikation: fortlaufender WMZ der Wohnung A,
 * Verfahren a absolut, Ausgleich über den Ausgleichsstand
 */
describe("§ 9a: Ausgleich im Folgejahr bei fortlaufenden Zählern", () => {
  const units = [unit("A", 20), unit("B", 80), unit("C", 100)];
  const wmzA = meter("WMZ-A", "A", "heat_meter");
  const others = (otherYear: number): ScopeMeter[] => [
    {
      meter: meter("WMZ-B", "B", "heat_meter"),
      readings: [
        reading(`${otherYear}-01-01`, 1000),
        reading(`${otherYear}-12-31`, 6000),
      ],
    },
    {
      meter: meter("WMZ-C", "C", "heat_meter"),
      readings: [
        reading(`${otherYear}-01-01`, 2000),
        reading(`${otherYear}-12-31`, 8000),
      ],
    },
  ];
  const readingsA = [
    reading("2025-01-01", 10_000),
    reading("2025-12-31", 16_000),
    // 31.12.2026 nicht abgelesen, echter Stand wäre 21.500
    reading("2027-12-31", 27_000),
  ];
  const year = (
    periodYear: number,
    readings: ReadingPoint[],
    extra: Partial<Parameters<typeof calculateHeating>[0]> = {},
  ) =>
    calculateHeating({
      totalHeatingCostsCents: 100_000,
      config: { consumptionShareBps: 7000 },
      units,
      consumptionMethod: "heat_meter",
      consumptionMeters: [{ meter: wmzA, readings }, ...others(periodYear)],
      periodStart: `${periodYear}-01-01`,
      periodEnd: `${periodYear}-12-31`,
      referenceMeters: { heating: [{ meter: wmzA, readings: readingsA }] },
      ...extra,
    });
  const failure = (
    overrides: Partial<SubstitutionInput> = {},
  ): SubstitutionInput =>
    substitution({
      id: "s-2026",
      unitId: "A",
      affectedMeterIds: ["WMZ-A"],
      meterKeptCounting: true,
      method: "same_rooms_comparable_period",
      referencePeriodStart: "2025-01-01",
      referencePeriodEnd: "2025-12-31",
      ...overrides,
    });
  const compensationsOf = (
    detail: ReturnType<typeof calculateHeating>,
    period: { start: string; end: string },
  ): CompensationInput[] =>
    (detail.substitutions ?? []).flatMap((entry) =>
      compensationsFromSubstitution(entry, period, "statement-of-period"),
    );
  const consumptionOfA = (detail: ReturnType<typeof calculateHeating>) =>
    detail.perUnit.find((row) => row.unitId === "A")?.consumptionKwh ?? 0;
  const y2 = { start: "2026-01-01", end: "2026-12-31" };

  it("rechnet Jahr 2 mit Ersatzwert und Jahr 3 ab dem Ausgleichsstand", () => {
    // Zum Zeitpunkt der Abrechnung 2026 gibt es den Stand von 2027 noch nicht.
    const year2 = year(2026, readingsA.slice(0, 2), {
      substitutions: [failure()],
    });
    expect(consumptionOfA(year2)).toBe(6000);
    expect(year2.substitutions?.[0]?.perMeter[0]?.periodStartValue).toBe(
      16_000,
    );

    const year3 = year(2027, readingsA, {
      compensations: compensationsOf(year2, y2),
    });
    expect(consumptionOfA(year3)).toBe(5000);
    expect(consumptionOfA(year2) + consumptionOfA(year3)).toBe(27_000 - 16_000);
    expect(year3.compensations?.[0]).toMatchObject({
      compensationValue: 22_000,
      nextReading: { date: "2027-12-31", value: 27_000 },
      resultingConsumption: 5000,
      source: { fromSnapshotOfStatementId: "statement-of-period" },
    });
    expect(codes(year3.warnings)).not.toContain("consumptionGap");
    expect(hasBlockingWarning({ heatingDetail: year3 })).toBe(false);

    // Ohne Ausgleich würde der Anfang 2027 interpoliert und Verbrauch doppelt
    // abgerechnet.
    const withoutCompensation = year(2027, readingsA);
    expect(
      consumptionOfA(year2) + consumptionOfA(withoutCompensation),
    ).toBeGreaterThan(11_000);
  });

  it("verteilt den Ausgleich bei Mieterwechsel mit Zwischenablesung auf den Vormieter", () => {
    const year2 = year(2026, readingsA.slice(0, 2), {
      substitutions: [failure()],
    });
    // Übergabe wie üblich: Stand am Auszugs- und am Einzugstag
    const readings = [
      ...readingsA,
      reading("2027-04-30", 24_000),
      reading("2027-05-01", 24_000),
    ];
    const outgoing = year(2027, readings, {
      compensations: compensationsOf(year2, y2),
      targetUnitId: "A",
      tenantPeriodStart: "2027-01-01",
      tenantPeriodEnd: "2027-04-30",
    });
    const incoming = year(2027, readings, {
      compensations: compensationsOf(year2, y2),
      targetUnitId: "A",
      tenantPeriodStart: "2027-05-01",
      tenantPeriodEnd: "2027-12-31",
    });

    expect(consumptionOfA(outgoing)).toBe(2000);
    expect(consumptionOfA(incoming)).toBe(3000);
  });

  it("teilt ohne Zwischenablesung zeitanteilig ab dem Ausgleichsstand", () => {
    const year2 = year(2026, readingsA.slice(0, 2), {
      substitutions: [failure()],
    });
    const tenant = year(2027, readingsA, {
      compensations: compensationsOf(year2, y2),
      targetUnitId: "A",
      tenantPeriodStart: "2027-01-01",
      tenantPeriodEnd: "2027-06-30",
    });

    // Stand am 30.06. linear zwischen 22.000 (01.01.) und 27.000 (31.12.)
    expect(consumptionOfA(tenant)).toBeCloseTo((5000 * 180) / 364, 6);
  });

  it("teilt den Ersatzwert bei Mieterwechsel im Ausfalljahr nach Tagen", () => {
    const year2 = year(2026, readingsA.slice(0, 2), {
      substitutions: [failure()],
      targetUnitId: "A",
      tenantPeriodStart: "2026-01-01",
      tenantPeriodEnd: "2026-06-30",
    });

    expect(consumptionOfA(year2)).toBeCloseTo((6000 * 181) / 365, 6);
  });

  it("blockiert einen negativen Ausgleich ohne Kappung und ohne Übertrag", () => {
    const year2 = year(2026, readingsA.slice(0, 2), {
      substitutions: [
        failure({
          basisSource: "manual_reference",
          manualAffectedConsumption: 12_000,
          basisNote: "Vergleichswert, der sich als zu hoch herausstellt",
        }),
      ],
    });
    const year3 = year(2027, readingsA, {
      compensations: compensationsOf(year2, y2),
    });

    expect(year3.compensations?.[0]).toMatchObject({
      compensationValue: 28_000,
      resultingConsumption: -1000,
    });
    expect(codes(year3.warnings)).toContain("substitutionCompensationNegative");
    expect(codes(year3.warnings)).not.toContain("consumptionNegative");
    expect(hasBlockingWarning({ heatingDetail: year3 })).toBe(true);

    // Im Jahr danach wirkt der Ausgleich nicht mehr, kein Übertrag.
    const year4 = year(
      2028,
      [
        ...readingsA,
        reading("2028-01-01", 27_000),
        reading("2028-12-31", 33_000),
      ],
      { compensations: compensationsOf(year2, y2) },
    );
    expect(year4.compensations).toBeUndefined();
    expect(consumptionOfA(year4)).toBe(6000);
  });

  it("blockiert einen negativen Mietabschnitt, auch wenn das Jahr positiv bleibt", () => {
    const year2 = year(2026, readingsA.slice(0, 2), {
      substitutions: [
        failure({
          basisSource: "manual_reference",
          manualAffectedConsumption: 8000,
          basisNote: "Messdienst",
        }),
      ],
    });
    const year3 = year(2027, [...readingsA, reading("2027-04-30", 23_500)], {
      compensations: compensationsOf(year2, y2),
      targetUnitId: "A",
      tenantPeriodStart: "2027-01-01",
      tenantPeriodEnd: "2027-04-30",
    });

    expect(codes(year3.warnings)).toContain("substitutionCompensationNegative");
  });

  it("verkettet zwei Ausfalljahre: echte Ablesung, Ersatz, Ersatz, echte Ablesung", () => {
    const year2 = year(2026, readingsA.slice(0, 2), {
      substitutions: [failure()],
    });
    const afterYear2 = compensationsOf(year2, y2);

    const year3 = year(2027, readingsA.slice(0, 2), {
      compensations: afterYear2,
      substitutedPeriods: [{ period: y2, meterIds: ["WMZ-A"] }],
      substitutions: [
        failure({
          id: "s-2027",
          periodStart: "2027-01-01",
          periodEnd: "2027-12-31",
          // Vergleichszeitraum 2025, zwei Jahre zurück
        }),
      ],
      periodStart: "2027-01-01",
      periodEnd: "2027-12-31",
    });
    expect(year3.substitutions?.[0]?.perMeter[0]?.periodStartValue).toBe(
      22_000,
    );
    expect(consumptionOfA(year3)).toBe(6000);

    const year4 = year(
      2028,
      [...readingsA.slice(0, 2), reading("2028-12-31", 33_000)],
      {
        compensations: [
          ...afterYear2,
          ...compensationsOf(year3, { start: "2027-01-01", end: "2027-12-31" }),
        ],
      },
    );

    expect(consumptionOfA(year4)).toBe(5000);
    expect(
      consumptionOfA(year2) + consumptionOfA(year3) + consumptionOfA(year4),
    ).toBe(33_000 - 16_000);
    // Nur der jüngste Ausgleichsstand wirkt ins Jahr 2028.
    expect(year4.compensations).toHaveLength(1);
    expect(year4.compensations?.[0]?.compensationValue).toBe(28_000);
  });

  it("ohne Weiterzählen gibt es keinen Ausgleich und alte Stände sind keine Stützstelle", () => {
    const year2 = year(2026, readingsA.slice(0, 2), {
      substitutions: [
        failure({ meterKeptCounting: false, reason: "device_failure" }),
      ],
    });
    const snapshots = year2.substitutions ?? [];
    expect(compensationsOf(year2, y2)).toEqual([]);

    const invalidations = snapshots.flatMap((entry) =>
      invalidationsFromSubstitution(entry, y2),
    );
    const year3 = year(2027, readingsA, {
      readingInvalidations: invalidations,
    });
    expect(codes(year3.warnings)).toContain("consumptionGap");

    // Mit neuem Anfangsstand nach der Reparatur wieder vollständig
    const repaired = year(2027, [...readingsA, reading("2027-01-01", 21_000)], {
      readingInvalidations: invalidations,
    });
    expect(codes(repaired.warnings)).not.toContain("consumptionGap");
    expect(consumptionOfA(repaired)).toBe(6000);
  });

  it("kein Ausgleich bei Stichtagsgeräten und bei § 9a Abs. 2", () => {
    expect(
      compensationsFromSubstitution(
        {
          substitutionId: "s",
          scope: "heating",
          method: "same_rooms_comparable_period",
          reason: "reading_missed",
          meterKeptCounting: true,
          appliedToDistribution: true,
          perMeter: [
            {
              meterId: "HKV",
              meterLabel: "HKV",
              periodStartValue: null,
              substituteConsumption: 100,
            },
          ],
        },
        y2,
      ),
    ).toEqual([]);
    expect(
      compensationsFromSubstitution(
        {
          substitutionId: "s",
          scope: "heating",
          method: "same_rooms_comparable_period",
          reason: "reading_missed",
          meterKeptCounting: true,
          appliedToDistribution: false,
          perMeter: [
            {
              meterId: "WMZ-A",
              meterLabel: "WMZ-A",
              periodStartValue: 16_000,
              substituteConsumption: 6000,
            },
          ],
        },
        y2,
      ),
    ).toEqual([]);
  });

  it("teilt einen Ersatzwert auf mehrere Zähler, die Wohnungssumme bleibt gleich", () => {
    const second = meter("WMZ-A2", "A", "heat_meter");
    const result = calculateHeating({
      totalHeatingCostsCents: 100_000,
      config: { consumptionShareBps: 7000 },
      units,
      consumptionMethod: "heat_meter",
      consumptionMeters: [
        { meter: wmzA, readings: readingsA.slice(0, 2) },
        { meter: second, readings: [reading("2025-12-31", 0)] },
        ...others(2026),
      ],
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      substitutions: [
        substitution({
          id: "s",
          unitId: "A",
          affectedMeterIds: ["WMZ-A", "WMZ-A2"],
          meterKeptCounting: true,
          comparisonUnitIds: ["B", "C"],
        }),
      ],
    });

    // Rate (5.000 + 6.000) / 180 m² x 20 m², gleichmäßig auf zwei Zähler
    const expected = (11_000 / 180) * 20;
    expect(
      result.substitutions?.[0]?.perMeter.map(
        (entry) => entry.substituteConsumption,
      ),
    ).toEqual([expected / 2, expected / 2]);
    expect(consumptionOfA(result)).toBeCloseTo(expected, 6);
  });
});

describe("§ 9a: Warmwasser", () => {
  const units = [unit("A", 20), unit("B", 80), unit("C", 100)];
  const hotWaterMeter = (id: string, unitId: string) =>
    meter(id, unitId, "water_hot");
  const unitMeters: ScopeMeter[] = [
    {
      meter: hotWaterMeter("WW-A", "A"),
      readings: [reading("2025-01-01", 100), reading("2025-12-31", 130)],
    },
    {
      meter: hotWaterMeter("WW-B", "B"),
      readings: [reading("2025-12-31", 0), reading("2026-12-31", 40)],
    },
    {
      meter: hotWaterMeter("WW-C", "C"),
      readings: [reading("2025-12-31", 0), reading("2026-12-31", 60)],
    },
  ];
  const heatMeters = ["A", "B", "C"].map((unitId) => ({
    meter: meter(`WMZ-${unitId}`, unitId, "heat_meter"),
    readings: [reading("2025-12-31", 0), reading("2026-12-31", 1000)],
  }));
  const calculate = (hotWater: {
    boilerHeatKwh: number | null;
    hotWaterVolumeM3: number | null;
  }) =>
    calculateHeating({
      totalHeatingCostsCents: 100_000,
      config: { consumptionShareBps: 7000 },
      units,
      consumptionMethod: "heat_meter",
      consumptionMeters: heatMeters,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      targetUnitId: "A",
      hotWater: {
        totalHeatEnergyKwh: 10_000,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [],
        unitMeters,
        ...hotWater,
      },
      referenceMeters: { hotWater: unitMeters },
      substitutions: [
        substitution({
          id: "s-ww",
          unitId: "A",
          scope: "hot_water",
          affectedMeterIds: ["WW-A"],
          meterKeptCounting: true,
          method: "same_rooms_comparable_period",
          referencePeriodStart: "2025-01-01",
          referencePeriodEnd: "2025-12-31",
        }),
      ],
    });

  it("setzt den absoluten Vorjahresverbrauch in m³ an", () => {
    const result = calculate({ boilerHeatKwh: 2000, hotWaterVolumeM3: null });
    const own = result.hotWaterDetail?.perUnit.find(
      (row) => row.unitId === "A",
    );

    expect(own?.hotWaterM3).toBe(30);
    expect(own?.hotWaterIsSubstituted).toBe(true);
    expect(result.substitutionArea?.hotWater).toEqual({
      affectedAreaSqm: 20,
      totalAreaSqm: 200,
      limitExceeded: false,
    });
    expect(codes(result.warnings)).toContain("substitutionHotWaterSameRooms");
    expect(codes(result.warnings)).not.toContain("hotWaterVolumeIncomplete");
  });

  it("blockiert, wenn Q_WW über die Formel mit unvollständigem V bestimmt wird", () => {
    const result = calculate({ boilerHeatKwh: null, hotWaterVolumeM3: 100 });

    expect(result.hotWaterDetail?.method).toBe("estimated");
    // V bleibt der gemessene Wert, ohne Ersatzwert.
    expect(result.hotWaterDetail?.hotWaterVolumeM3).toBe(100);
    expect(codes(result.warnings)).toContain("hotWaterVolumeIncomplete");
    expect(codes(result.warnings)).not.toContain("hotWaterFlatRateFallback");
    expect(hasBlockingWarning({ heatingDetail: result })).toBe(true);
  });
});

describe("§ 9a: Referenzmenge des Gebäudedurchschnitts", () => {
  const hkvMeter = (id: string, unitId: string, end: number): ScopeMeter => ({
    meter: meter(id, unitId, "heat_cost_allocator"),
    readings: [reading("2026-01-01", 0), reading("2026-12-31", end)],
  });
  const failed: ScopeMeter = {
    meter: meter("HKV-A", "A", "heat_cost_allocator"),
    readings: [reading("2026-01-01", 0)],
  };
  const calculate = (
    units: UnitInfo[],
    meters: ScopeMeter[],
    group?: string[],
  ) =>
    calculateHeating({
      totalHeatingCostsCents: 100_000,
      config: { consumptionShareBps: 7000 },
      units,
      consumptionMethod: "heat_cost_allocator",
      consumptionMeters: [failed, ...meters],
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      substitutions: [
        substitution({
          id: "s-a",
          unitId: "A",
          affectedMeterIds: ["HKV-A"],
          comparisonUnitIds: group ?? null,
        }),
      ],
    });

  it("lässt Wohnungen ohne Zähler mit Verbrauch und Fläche weg", () => {
    const result = calculate(
      [unit("A", 100), unit("B", 100), unit("C", 100), unit("D", 100)],
      [hkvMeter("HKV-B", "B", 1000), hkvMeter("HKV-C", "C", 1000)],
    );
    const [entry] = result.substitutions ?? [];

    // 2.000 Einheiten / 200 m², nicht 2.000 / 300 m²
    expect(entry?.basis.ratePerSqm).toBe(10);
    expect(entry?.basis.comparisonUnitNames).toEqual(["B", "C"]);
    expect(entry?.substituteConsumption).toBe(1000);
  });

  it("behält eine Wohnung mit gemessenem Verbrauch 0 samt Fläche", () => {
    const result = calculate(
      [unit("A", 100), unit("B", 100), unit("C", 100), unit("Z", 100)],
      [
        hkvMeter("HKV-B", "B", 1000),
        hkvMeter("HKV-C", "C", 1000),
        hkvMeter("HKV-Z", "Z", 0),
      ],
    );
    const [entry] = result.substitutions ?? [];

    expect(entry?.basis.comparisonUnitNames).toEqual(["B", "C", "Z"]);
    expect(entry?.basis.comparisonAreaSqm).toBe(300);
    expect(entry?.basis.ratePerSqm).toBeCloseTo(2000 / 300, 10);
  });

  it("wertet in einer Nutzergruppe eine Wohnung ohne Zähler als ungeeignet", () => {
    const result = calculate(
      [unit("A", 100), unit("B", 100), unit("C", 100), unit("D", 100)],
      [hkvMeter("HKV-B", "B", 1000), hkvMeter("HKV-C", "C", 1000)],
      ["B", "D"],
    );

    expect(codes(result.warnings)).toContain("substitutionComparisonInvalid");
  });
});
