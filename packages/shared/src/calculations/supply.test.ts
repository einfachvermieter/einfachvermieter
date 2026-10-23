import { describe, expect, it } from "vitest";
import { heatingDetailSchema } from "../schemas/statement-result.js";
import type {
  MeterInfo,
  Period,
  ReadingPoint,
  UnitInfo,
} from "../types/index.js";
import { hasBlockingWarning, isTenantWarning } from "./diagnostics.js";
import { calculateHeating } from "./heating.js";
import { averageUserComparison, co2AreaIsPartial } from "./heatingDisplay.js";
import type { SubstitutionInput } from "./substitution.js";
import { type SupplyExclusion, suppliedPeriods } from "./supply.js";

const PERIOD: Period = { start: "2027-01-01", end: "2027-12-31" };
const YEAR = [PERIOD];

const reading = (
  date: string,
  value: number,
  isEstimated = false,
): ReadingPoint => ({ date, value, isCumulative: true, isEstimated });

const unit = (id: string, areaSqm: number, occupiedDays = 365): UnitInfo => ({
  id,
  name: id,
  areaSqm,
  occupantCount: 1,
  personDays: occupiedDays,
  occupiedDays,
  periodDays: 365,
});

const meter = (
  id: string,
  unitId: string,
  type: MeterInfo["type"] = "heat_meter",
  resetDay: string | null = null,
): MeterInfo => ({
  id,
  type,
  role: "unit",
  unitId,
  label: id,
  measurementUnit: type === "water_hot" ? "m3" : "kwh",
  kTotal: type === "heat_cost_allocator" ? 1 : null,
  validFrom: "1900-01-01",
  validUntil: null,
  resetDay,
});

const exclusion = (
  unitId: string,
  validFrom: string,
  validUntil: string | null = null,
  scope: SupplyExclusion["scope"] = "heating",
): SupplyExclusion => ({ unitId, scope, validFrom, validUntil });

const substitution = (
  unitId: string,
  affectedMeterIds: string[],
): SubstitutionInput => ({
  id: `sub-${unitId}`,
  unitId,
  affectedMeterIds,
  periodStart: PERIOD.start,
  periodEnd: PERIOD.end,
  scope: "heating",
  reason: "reading_not_possible",
  reasonNote: null,
  meterKeptCounting: null,
  affectedAreaSqm: null,
  method: "building_or_group_average",
  basisSource: "manual_reference",
  referencePeriodStart: null,
  referencePeriodEnd: null,
  referenceMeterIds: null,
  comparisonUnitIds: null,
  manualAffectedConsumption: null,
  manualTotalConsumption: null,
  manualComparisonConsumption: 100,
  manualComparisonAreaSqm: 10,
  basisNote: "Test",
});

const codes = (warnings: Array<{ code: string }> | undefined) =>
  (warnings ?? []).map((warning) => warning.code);

type Overrides = Partial<Parameters<typeof calculateHeating>[0]> & {
  exclusions?: SupplyExclusion[];
  occupied?: Record<string, Period[]>;
  readingsB?: ReadingPoint[];
};

/**
 * Zwei Wohnungen mit Wärmemengenzählern: A 60 qm, 700 kWh; B 40 qm. Topf
 * 1.000,00 €, 70 % Verbrauch.
 */
const calc = ({ exclusions, occupied, readingsB, ...rest }: Overrides = {}) =>
  calculateHeating({
    totalHeatingCostsCents: 100_000,
    config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
    units: [unit("A", 60), unit("B", 40)],
    consumptionMeters: [
      {
        meter: meter("mA", "A"),
        readings: [reading("2027-01-01", 0), reading("2027-12-31", 700)],
      },
      {
        meter: meter("mB", "B"),
        readings: readingsB ?? [
          reading("2027-01-01", 0),
          reading("2027-12-31", 300),
        ],
      },
    ],
    consumptionMethod: "heat_meter",
    periodStart: PERIOD.start,
    periodEnd: PERIOD.end,
    ...(exclusions
      ? {
          supply: {
            exclusions,
            occupiedSpansByUnit: new Map(
              Object.entries({ A: YEAR, B: YEAR, ...occupied }),
            ),
          },
        }
      : {}),
    ...rest,
  });

const row = (detail: ReturnType<typeof calc>, unitId: string) =>
  detail.perUnit.find((entry) => entry.unitId === unitId);

describe("suppliedPeriods", () => {
  it("liefert die Zeiträume ohne Nichtteilnahme, unabhängig von der Belegung", () => {
    expect(suppliedPeriods([], "B", "heating", PERIOD)).toEqual([
      { ...PERIOD, startIsBoundary: false, endIsBoundary: false },
    ]);
    expect(
      suppliedPeriods([exclusion("B", "2027-07-01")], "B", "heating", PERIOD),
    ).toEqual([
      {
        start: "2027-01-01",
        end: "2027-06-30",
        startIsBoundary: false,
        endIsBoundary: true,
      },
    ]);
    // Lücke in der Mitte, anderer Bereich und andere Wohnung zählen nicht
    expect(
      suppliedPeriods(
        [
          exclusion("B", "2027-03-01", "2027-03-31"),
          exclusion("B", "2027-01-01", null, "hot_water"),
          exclusion("A", "2027-01-01"),
        ],
        "B",
        "heating",
        PERIOD,
      ).map(({ start, end }) => [start, end]),
    ).toEqual([
      ["2027-01-01", "2027-02-28"],
      ["2027-04-01", "2027-12-31"],
    ]);
    expect(
      suppliedPeriods([exclusion("B", "2020-01-01")], "B", "heating", PERIOD),
    ).toEqual([]);
  });

  it("markiert den Periodenanfang als Grenze, wenn der Vortag nicht versorgt war", () => {
    expect(
      suppliedPeriods(
        [exclusion("B", "2026-01-01", "2026-12-31")],
        "B",
        "heating",
        PERIOD,
      ),
    ).toEqual([{ ...PERIOD, startIsBoundary: true, endIsBoundary: false }]);
  });
});

describe("calculateHeating mit Versorgungsteilnahme", () => {
  it("rechnet ohne Nichtteilnahme wie bisher", () => {
    expect(calc({ exclusions: [] })).toEqual(calc());
    // Eintrag außerhalb der Periode
    expect(
      calc({ exclusions: [exclusion("B", "2020-01-01", "2020-12-31")] }),
    ).toEqual(calc());
  });

  it("verteilt nur auf angeschlossene Wohnungen, ohne Vermieteranteil", () => {
    const detail = calc({
      exclusions: [exclusion("B", "2020-01-01")],
      // Kein Zähler nötig für die nicht versorgte Wohnung
      consumptionMeters: [
        {
          meter: meter("mA", "A"),
          readings: [reading("2027-01-01", 0), reading("2027-12-31", 700)],
        },
      ],
    });

    expect(detail.perUnit.map((entry) => entry.unitId)).toEqual(["A"]);
    expect(row(detail, "A")?.totalCents).toBe(100_000);
    expect(detail.landlordBasicCostCents).toBe(0);
    expect(detail.landlordConsumptionCostCents).toBe(0);
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
    expect(detail.supply?.heating).toEqual([
      {
        unitId: "A",
        unitName: "A",
        suppliedDays: 365,
        periodDays: 365,
        suppliedPeriods: YEAR,
      },
      {
        unitId: "B",
        unitName: "B",
        suppliedDays: 0,
        periodDays: 365,
        suppliedPeriods: [],
      },
    ]);
    expect(codes(detail.warnings)).toContain("supplyPartialParticipation");
    expect(() => heatingDetailSchema.parse(detail)).not.toThrow();
  });

  it("Wechsel mit echter Grenzablesung: Verbrauch bis zur Grenze, Grundkosten nach versorgten Tagen", () => {
    for (const boundaryDate of ["2027-06-30", "2027-07-01"]) {
      const detail = calc({
        exclusions: [exclusion("B", "2027-07-01")],
        // Zähler bleibt eingebaut und zählt weiter: 200 kWh nach der Grenze
        readingsB: [
          reading("2027-01-01", 0),
          reading(boundaryDate, 300),
          reading("2027-12-31", 500),
        ],
      });

      expect(row(detail, "B")?.consumptionKwh).toBe(300);
      expect(row(detail, "A")?.consumptionCostCents).toBe(49_000);
      expect(row(detail, "B")?.consumptionCostCents).toBe(21_000);
      // Grundkosten 30.000 ct nach 60 x 365 zu 40 x 181 Flächentagen
      expect(row(detail, "A")?.basicCostCents).toBe(
        Math.round((30_000 * 60 * 365) / (60 * 365 + 40 * 181)),
      );
      expect(
        (row(detail, "A")?.basicCostCents ?? 0) +
          (row(detail, "B")?.basicCostCents ?? 0),
      ).toBe(30_000);
      expect(detail.landlordBasicCostCents).toBe(0);
      expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
      expect(detail.supply?.heating?.[1]).toMatchObject({
        suppliedDays: 181,
        suppliedPeriods: [{ start: "2027-01-01", end: "2027-06-30" }],
      });
    }
  });

  it("Wechsel ohne echte Grenzablesung blockiert, es wird nicht interpoliert", () => {
    const cases: ReadingPoint[][] = [
      [reading("2027-01-01", 0), reading("2027-12-31", 300)],
      [
        reading("2027-01-01", 0),
        reading("2027-05-31", 250),
        reading("2027-07-31", 300),
      ],
      [
        reading("2027-01-01", 0),
        reading("2027-06-30", 280, true),
        reading("2027-12-31", 300),
      ],
    ];

    for (const readingsB of cases) {
      const detail = calc({
        exclusions: [exclusion("B", "2027-07-01")],
        readingsB,
      });
      const gap = detail.warnings?.find(
        (warning) => warning.code === "supplyBoundaryReadingMissing",
      );

      expect(gap?.params).toMatchObject({
        unitId: "B",
        meterId: "mB",
        date: "2027-06-30",
      });
      expect(codes(detail.warnings)).not.toContain("consumptionGap");
      expect(hasBlockingWarning({ heatingDetail: detail })).toBe(true);
    }
  });

  it("ein Erfassungsausfall löst die fehlende Grenzablesung nicht auf", () => {
    const detail = calc({
      exclusions: [exclusion("B", "2027-07-01")],
      substitutions: [substitution("B", ["mB"])],
    });

    expect(codes(detail.warnings)).toEqual(
      expect.arrayContaining([
        "supplyBoundaryReadingMissing",
        "supplyChangeWithSubstitution",
      ]),
    );
    expect(detail.substitutions).toBeUndefined();
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(true);
  });

  it("Beginn der zentralen Versorgung mitten im Jahr mit Einbaustand", () => {
    for (const installDate of ["2027-07-01", "2027-06-30"]) {
      const detail = calc({
        exclusions: [exclusion("B", "2020-01-01", "2027-06-30")],
        readingsB: [reading(installDate, 0), reading("2027-12-31", 300)],
      });

      expect(row(detail, "B")?.consumptionKwh).toBe(300);
      expect(row(detail, "B")?.basicCostCents).toBe(
        30_000 - Math.round((30_000 * 60 * 365) / (60 * 365 + 40 * 184)),
      );
      expect(detail.supply?.heating?.[1]?.suppliedDays).toBe(184);
      expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
    }
  });

  it("HKV mit Stichtag: Grenze im Zählabschnitt, Nullstand nach dem Stichtag", () => {
    const allocator = (id: string, unitId: string) =>
      meter(id, unitId, "heat_cost_allocator", "12-31");
    const base = {
      consumptionMethod: "heat_cost_allocator" as const,
      consumptionMeters: [
        {
          meter: allocator("mA", "A"),
          readings: [reading("2027-01-01", 0), reading("2027-12-31", 700)],
        },
      ],
    };

    // Ende der Versorgung im laufenden Abschnitt
    const ended = calc({
      ...base,
      exclusions: [exclusion("B", "2027-07-01")],
      consumptionMeters: [
        ...base.consumptionMeters,
        {
          meter: allocator("mB", "B"),
          readings: [
            reading("2027-01-01", 0),
            reading("2027-06-30", 300),
            reading("2027-12-31", 450),
          ],
        },
      ],
    });
    expect(row(ended, "B")?.consumptionKwh).toBe(300);
    expect(hasBlockingWarning({ heatingDetail: ended })).toBe(false);

    // Beginn am Tag nach dem Stichtag: Das Gerät steht auf 0, der alte
    // Jahreswert vom Stichtag zählt nicht.
    const started = calc({
      ...base,
      exclusions: [exclusion("B", "2026-01-01", "2026-12-31")],
      consumptionMeters: [
        ...base.consumptionMeters,
        {
          meter: allocator("mB", "B"),
          readings: [reading("2026-12-31", 999), reading("2027-12-31", 300)],
        },
      ],
    });
    expect(row(started, "B")?.consumptionKwh).toBe(300);
    expect(hasBlockingWarning({ heatingDetail: started })).toBe(false);
  });

  it("trennt Versorgung und Belegung: Leerstand nur in versorgter Zeit", () => {
    // B steht das ganze Jahr leer und ist bis 30.06. versorgt
    const detail = calc({
      units: [unit("A", 60), unit("B", 40, 0)],
      exclusions: [exclusion("B", "2027-07-01")],
      occupied: { B: [] },
      readingsB: [reading("2027-01-01", 0), reading("2027-06-30", 0)],
    });

    expect(row(detail, "B")?.basicCostCents).toBe(0);
    expect(detail.landlordBasicCostCents).toBe(
      30_000 - Math.round((30_000 * 60 * 365) / (60 * 365 + 40 * 181)),
    );
    // Die Versorgung selbst hängt nicht an der Belegung
    expect(detail.supply?.heating?.[1]?.suppliedDays).toBe(181);
  });

  it("Nutzerwechsel in versorgter Zeit wird weiter interpoliert, die Versorgungsgrenze nicht", () => {
    const tenant = { start: "2027-01-01", end: "2027-03-31" };
    const detail = calc({
      targetUnitId: "B",
      tenantPeriodStart: tenant.start,
      tenantPeriodEnd: tenant.end,
      units: [unit("A", 60), unit("B", 40, 90)],
      exclusions: [exclusion("B", "2027-07-01")],
      occupied: { B: [tenant] },
      readingsB: [
        reading("2027-01-01", 0),
        reading("2027-06-30", 181),
        reading("2027-12-31", 500),
      ],
    });

    // 1 kWh je Tag: 89 Tage Abstand bis zum Auszug, Rest bis zur Grenze
    // fällt dem Vermieter zu, nichts danach
    expect(row(detail, "B")?.consumptionKwh).toBeCloseTo(89.5, 0);
    const total =
      (row(detail, "A")?.consumptionCostCents ?? 0) +
      (row(detail, "B")?.consumptionCostCents ?? 0) +
      (detail.landlordConsumptionCostCents ?? 0);
    expect(total).toBe(70_000);
    expect(detail.landlordConsumptionCostCents).toBeGreaterThan(0);
    expect(row(detail, "B")?.basicCostCents).toBe(
      Math.round((30_000 * 40 * 90) / (60 * 365 + 40 * 181)),
    );
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
  });

  it("25-%-Grenze: Gesamtfläche nach versorgten Tagen, unabhängig vom Mieter", () => {
    const input = {
      exclusions: [exclusion("B", "2027-07-01")],
      readingsB: [reading("2027-01-01", 0), reading("2027-06-30", 300)],
      substitutions: [substitution("A", ["mA"])],
    };
    const expected = 60 + (40 * 181) / 365;

    expect(calc(input).substitutionArea?.heating?.totalAreaSqm).toBeCloseTo(
      expected,
      6,
    );
    expect(
      calc({
        ...input,
        targetUnitId: "B",
        tenantPeriodStart: "2027-01-01",
        tenantPeriodEnd: "2027-03-31",
        occupied: { B: [{ start: "2027-01-01", end: "2027-03-31" }] },
      }).substitutionArea?.heating?.totalAreaSqm,
    ).toBeCloseTo(expected, 6);
  });

  it("ignoriert einen Erfassungsausfall der ganzjährig nicht versorgten Wohnung", () => {
    const detail = calc({
      exclusions: [exclusion("B", "2020-01-01")],
      substitutions: [substitution("B", ["mB"])],
    });

    expect(detail.substitutions).toBeUndefined();
    expect(detail.substitutionArea).toBeUndefined();
    expect(codes(detail.warnings)).not.toContain(
      "supplyChangeWithSubstitution",
    );
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
  });

  it("versorgte Wohnung ohne Zähler blockiert immer", () => {
    const one = calc({
      consumptionMeters: [
        {
          meter: meter("mA", "A"),
          readings: [reading("2027-01-01", 0), reading("2027-12-31", 700)],
        },
      ],
    });
    expect(
      one.warnings?.find(
        (warning) => warning.code === "consumptionMeterMissingHeating",
      )?.params,
    ).toMatchObject({ unitId: "B" });
    expect(hasBlockingWarning({ heatingDetail: one })).toBe(true);

    const none = calc({ consumptionMeters: [] });
    expect(
      codes(none.warnings).filter(
        (code) => code === "consumptionMeterMissingHeating",
      ),
    ).toHaveLength(2);
    expect(hasBlockingWarning({ heatingDetail: none })).toBe(true);
  });

  it("keine Wohnung versorgt, aber Kosten vorhanden: blockiert", () => {
    const exclusions = [
      exclusion("A", "2020-01-01"),
      exclusion("B", "2020-01-01"),
    ];
    const withCosts = calc({ exclusions });
    expect(codes(withCosts.warnings)).toContain("supplyNoParticipantsHeating");
    expect(hasBlockingWarning({ heatingDetail: withCosts })).toBe(true);

    const withoutCosts = calc({ exclusions, totalHeatingCostsCents: 0 });
    expect(hasBlockingWarning({ heatingDetail: withoutCosts })).toBe(false);
  });

  it("Durchschnittsnutzer-Vergleich nur mit ganzjährig versorgten Wohnungen", () => {
    const detail = calc({
      exclusions: [exclusion("B", "2027-07-01")],
      readingsB: [reading("2027-01-01", 0), reading("2027-06-30", 300)],
    });

    // Nur A ist ganzjährig versorgt: kein Durchschnitt möglich
    expect(averageUserComparison(detail, "A", PERIOD, PERIOD)).toBeNull();
    expect(averageUserComparison(calc(), "A", PERIOD, PERIOD)).not.toBeNull();
  });
});

const hotWaterMeter = (id: string, unitId: string, end: ReadingPoint[]) => ({
  meter: meter(id, unitId, "water_hot"),
  readings: [reading("2027-01-01", 0), ...end],
});

const hotWater = (unitMeters: ReturnType<typeof hotWaterMeter>[]) => ({
  totalHeatEnergyKwh: 10_000,
  boilerHeatKwh: null,
  hotWaterVolumeM3: null,
  supplyTemperatureCelsius: 60,
  unitHotWaterM3: [],
  unitMeters,
});

describe("Warmwasser mit Versorgungsteilnahme", () => {
  it("Pauschale: AWohn nur die versorgte Wohnfläche, nach Tagen gewichtet", () => {
    const whole = calc({
      exclusions: [exclusion("B", "2020-01-01", null, "hot_water")],
      hotWater: hotWater([
        hotWaterMeter("wA", "A", [reading("2027-12-31", 0)]),
      ]),
    });
    expect(whole.hotWaterDetail?.hotWaterHeatKwh).toBeCloseTo(32 * 60, 6);
    expect(whole.hotWaterDetail?.perUnit.map((entry) => entry.unitId)).toEqual([
      "A",
    ]);
    expect(whole.hotWaterDetail?.landlordBasicCostCents).toBe(0);
    // Heizung bleibt für beide Wohnungen
    expect(whole.perUnit).toHaveLength(2);
    expect(whole.supply?.heating).toBeUndefined();
    expect(whole.supply?.hotWater?.[1]?.suppliedDays).toBe(0);

    const partial = calc({
      exclusions: [exclusion("B", "2027-07-01", null, "hot_water")],
      hotWater: hotWater([
        hotWaterMeter("wA", "A", [reading("2027-12-31", 0)]),
        hotWaterMeter("wB", "B", [reading("2027-06-30", 0)]),
      ]),
    });
    expect(partial.hotWaterDetail?.hotWaterHeatKwh).toBeCloseTo(
      32 * (60 + (40 * 181) / 365),
      6,
    );
  });

  it("Zähler bleibt nach Ende der Versorgung: späterer Verbrauch zählt nicht, auch nicht im Volumen", () => {
    const detail = calc({
      exclusions: [exclusion("B", "2027-07-01", null, "hot_water")],
      hotWater: {
        ...hotWater([
          hotWaterMeter("wA", "A", [reading("2027-12-31", 30)]),
          hotWaterMeter("wB", "B", [
            reading("2027-06-30", 10),
            reading("2027-12-31", 25),
          ]),
        ]),
        boilerHeatKwh: 2000,
      },
    });
    const rows = detail.hotWaterDetail?.perUnit ?? [];

    expect(rows.find((entry) => entry.unitId === "B")?.hotWaterM3).toBe(10);
    expect(rows.reduce((acc, entry) => acc + entry.hotWaterM3, 0)).toBe(40);
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
  });

  it("versorgte Wohnung ohne Warmwasserzähler blockiert, nicht versorgte nicht", () => {
    const meters = [hotWaterMeter("wA", "A", [reading("2027-12-31", 30)])];

    const missing = calc({ hotWater: hotWater(meters) });
    expect(codes(missing.warnings)).toContain(
      "consumptionMeterMissingHotWater",
    );

    const excluded = calc({
      exclusions: [exclusion("B", "2020-01-01", null, "hot_water")],
      hotWater: hotWater(meters),
    });
    expect(codes(excluded.warnings)).not.toContain(
      "consumptionMeterMissingHotWater",
    );
  });
});

describe("Maßgebliche Wohnfläche der CO2-Einstufung (§ 5 Abs. 1 Satz 2 CO2KostAufG)", () => {
  // 1.190 kg: 11,9 kg/qm bei 100 qm (0 %), 19,8 kg/qm bei 60 qm (20 %)
  const co2 = (totalAmountGrams = 1_190_000) => ({
    enabled: true,
    totalCostCents: 10_000,
    totalAmountGrams,
  });
  const bothHotWaterMeters = hotWater([
    hotWaterMeter("wA", "A", [reading("2027-12-31", 0)]),
    hotWaterMeter("wB", "B", [reading("2027-12-31", 0)]),
  ]);
  const area = (detail: ReturnType<typeof calc>) =>
    detail.co2Detail?.livingAreaSqm;
  const hotWaterOnlyUnits = (detail: ReturnType<typeof calc>) =>
    (detail.warnings ?? [])
      .filter((warning) => warning.code === "co2AreaHotWaterOnly")
      .map((warning) => warning.params?.unitId);

  it("ohne Nichtteilnahme zählt die Wohnfläche aller Wohnungen", () => {
    expect(area(calc({ co2: co2() }))).toBe(100);
    expect(area(calc({ co2: co2(), exclusions: [] }))).toBe(100);
    expect(co2AreaIsPartial(calc({ co2: co2() }))).toBe(false);
  });

  it("ganzjährig nicht beheizte Wohnung zählt nicht, die Stufe steigt", () => {
    const whole = calc({ co2: co2() });
    const partial = calc({
      co2: co2(),
      exclusions: [exclusion("B", "2020-01-01")],
    });

    expect(whole.co2Detail).toMatchObject({
      emissionsKgPerSqmYear: 11.9,
      landlordSharePercent: 0,
      landlordDeductionCents: 0,
    });
    expect(partial.co2Detail).toMatchObject({
      livingAreaSqm: 60,
      emissionsKgPerSqmYear: 19.8,
      landlordSharePercent: 20,
      landlordDeductionCents: 2000,
    });
    expect(co2AreaIsPartial(partial)).toBe(true);
    // Abzug des Vermieters plus verteilter Topf ergibt die Gesamtkosten
    expect(partial.totalHeatingCostsCents).toBe(98_000);
    expect(row(partial, "A")?.totalCents).toBe(98_000);
  });

  it("kleinere Fläche in derselben Stufe ändert den Abzug nicht", () => {
    // 5.500 kg: 55,0 kg/qm bei 100 qm, 91,7 kg/qm bei 60 qm, beides 95 %
    const whole = calc({ co2: co2(5_500_000) });
    const partial = calc({
      co2: co2(5_500_000),
      exclusions: [exclusion("B", "2020-01-01")],
    });

    expect(partial.co2Detail?.emissionsKgPerSqmYear).toBe(91.7);
    expect(whole.co2Detail?.landlordDeductionCents).toBe(9500);
    expect(partial.co2Detail?.landlordDeductionCents).toBe(9500);
  });

  it("stuft an der Grenze mit der maßgeblichen Fläche ein", () => {
    const exclusions = [exclusion("B", "2020-01-01")];
    const atLimit = calc({ co2: co2(717_600), exclusions });
    const below = calc({ co2: co2(716_400), exclusions });

    expect(atLimit.co2Detail).toMatchObject({
      emissionsKgPerSqmYear: 12,
      landlordSharePercent: 10,
    });
    expect(below.co2Detail).toMatchObject({
      emissionsKgPerSqmYear: 11.9,
      landlordSharePercent: 0,
    });
  });

  it("eigenes Warmwasser nimmt eine beheizte Wohnung nicht aus der Fläche", () => {
    const detail = calc({
      co2: co2(),
      exclusions: [exclusion("B", "2020-01-01", null, "hot_water")],
      hotWater: hotWater([
        hotWaterMeter("wA", "A", [reading("2027-12-31", 0)]),
      ]),
    });

    expect(area(detail)).toBe(100);
    expect(co2AreaIsPartial(detail)).toBe(false);
    expect(hotWaterOnlyUnits(detail)).toEqual([]);
  });

  it("nur Warmwasser aus der Anlage: zählt nicht, mit Hinweis an den Vermieter", () => {
    const detail = calc({
      co2: co2(),
      exclusions: [exclusion("B", "2020-01-01")],
      hotWater: bothHotWaterMeters,
    });

    expect(area(detail)).toBe(60);
    expect(hotWaterOnlyUnits(detail)).toEqual(["B"]);
    expect(isTenantWarning({ code: "co2AreaHotWaterOnly" })).toBe(false);
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
  });

  it("kein Hinweis ohne zentrales Warmwasser und keiner bei Selbstversorgung", () => {
    const withoutHotWater = calc({
      co2: co2(),
      exclusions: [exclusion("B", "2020-01-01")],
    });
    const selfSupplied = calc({
      co2: co2(),
      exclusions: [
        exclusion("B", "2020-01-01"),
        exclusion("B", "2020-01-01", null, "hot_water"),
      ],
      hotWater: hotWater([
        hotWaterMeter("wA", "A", [reading("2027-12-31", 0)]),
      ]),
    });

    expect(hotWaterOnlyUnits(withoutHotWater)).toEqual([]);
    expect(hotWaterOnlyUnits(selfSupplied)).toEqual([]);
    expect(area(selfSupplied)).toBe(60);
  });

  it("nur zeitweise ohne Heizung aus der Anlage: Fläche nach versorgten Tagen, Hinweis bleibt", () => {
    const detail = calc({
      co2: co2(),
      exclusions: [exclusion("B", "2027-07-01")],
      readingsB: [reading("2027-01-01", 0), reading("2027-06-30", 300)],
      hotWater: bothHotWaterMeters,
    });

    expect(area(detail)).toBeCloseTo(60 + (40 * 181) / 365, 9);
    expect(hotWaterOnlyUnits(detail)).toEqual(["B"]);
  });

  it("Versorgung beginnt im Zeitraum", () => {
    const detail = calc({
      co2: co2(),
      exclusions: [exclusion("B", "2020-01-01", "2027-06-30")],
      readingsB: [reading("2027-07-01", 0), reading("2027-12-31", 300)],
    });

    expect(area(detail)).toBeCloseTo(60 + (40 * 184) / 365, 9);
  });

  it("Schaltjahr rechnet mit 366 Tagen", () => {
    const detail = calc({
      co2: co2(1_190_000),
      units: [
        { ...unit("A", 60), periodDays: 366 },
        { ...unit("B", 40), periodDays: 366 },
      ],
      consumptionMeters: [],
      periodStart: "2028-01-01",
      periodEnd: "2028-12-31",
      exclusions: [exclusion("B", "2028-07-01")],
    });

    expect(area(detail)).toBeCloseTo(60 + (40 * 182) / 366, 9);
  });

  it("mehrere Wohnungen mit verschiedenen Zeiträumen: Summe der Anteile", () => {
    const detail = calc({
      co2: co2(),
      units: [unit("A", 60), unit("B", 40), unit("C", 50), unit("D", 30)],
      consumptionMeters: [],
      exclusions: [
        // B endet im März, C beginnt im Oktober, D mit Lücke im Juni
        exclusion("B", "2027-04-01"),
        exclusion("C", "2020-01-01", "2027-09-30"),
        exclusion("D", "2027-06-01", "2027-06-30"),
      ],
    });

    expect(area(detail)).toBeCloseTo(
      60 + (40 * 90) / 365 + (50 * 92) / 365 + (30 * 335) / 365,
      9,
    );
  });

  it("Leerstand und abweichende Heizfläche ändern die Fläche nicht", () => {
    const detail = calc({
      co2: co2(),
      units: [unit("A", 60), { ...unit("B", 40, 0), heatingAreaSqm: 25 }],
      exclusions: [],
    });

    expect(area(detail)).toBe(100);
  });

  it("gleiche Fläche in den Abrechnungen aller Mieter", () => {
    const exclusions = [exclusion("B", "2027-07-01")];
    const readingsB = [reading("2027-01-01", 0), reading("2027-06-30", 300)];
    const forA = calc({ co2: co2(), exclusions, readingsB, targetUnitId: "A" });
    const forB = calc({ co2: co2(), exclusions, readingsB, targetUnitId: "B" });

    expect(area(forA)).toBe(area(forB));
    expect(forA.co2Detail?.landlordDeductionCents).toBe(
      forB.co2Detail?.landlordDeductionCents,
    );
  });

  it("keine Wohnung beheizt: keine Einstufung, kein Abzug, blockiert", () => {
    const detail = calc({
      co2: co2(),
      exclusions: [exclusion("A", "2020-01-01"), exclusion("B", "2020-01-01")],
    });

    expect(detail.co2Detail).toBeUndefined();
    expect(detail.totalHeatingCostsCents).toBe(100_000);
    expect(codes(detail.warnings)).toContain("co2SplitMissingData");
    expect(codes(detail.warnings)).toContain("supplyNoParticipantsHeating");
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(true);
  });
});
