import { createI18nSync, createTranslate } from "@einfachvermieter/i18n";
import { describe, expect, it } from "vitest";
import type {
  HeatingBaseMethod,
  MeterInfo,
  Period,
  ReadingPoint,
  UnitInfo,
} from "../index.js";
import {
  heatingDetailSchema,
  statementResultSchema,
} from "../schemas/statement-result.js";
import { unitCreateSchema, unitFormSchema } from "../schemas/units.js";
import { hasBlockingWarning } from "./diagnostics.js";
import { baseCostAreaFor, calculateHeating } from "./heating.js";
import { averageUserComparison } from "./heatingDisplay.js";
import { calculateStatement } from "./statement.js";
import type { SubstitutionInput } from "./substitution.js";

const PERIOD: Period = { start: "2027-01-01", end: "2027-12-31" };

const unit = (
  id: string,
  areaSqm: number,
  heatingAreaSqm: number | null,
  occupiedDays = 365,
): UnitInfo => ({
  id,
  name: id,
  areaSqm,
  heatingAreaSqm,
  occupantCount: 1,
  personDays: occupiedDays,
  occupiedDays,
  periodDays: 365,
});

const reading = (date: string, value: number): ReadingPoint => ({
  date,
  value,
  isCumulative: true,
  isEstimated: false,
});

const meter = (
  unitId: string,
  type: MeterInfo["type"] = "heat_meter",
): MeterInfo => ({
  id: `m${unitId}-${type}`,
  type,
  role: "unit",
  unitId,
  label: `m${unitId}`,
  measurementUnit: type === "water_hot" ? "m3" : "kwh",
  validFrom: "1900-01-01",
  validUntil: null,
});

const metered = (unitId: string, kwh: number) => ({
  meter: meter(unitId),
  readings: [reading(PERIOD.start, 0), reading(PERIOD.end, kwh)],
});

const codes = (detail: { warnings?: Array<{ code: string }> }) =>
  (detail.warnings ?? []).map((warning) => warning.code);

/**
 * A 60 qm ohne Angabe, B 40 qm mit 30 qm Heizfläche, C 50 qm mit
 * Heizfläche 0 und ohne Zähler. Topf 1.000,00 €, 30 % Grundkosten.
 */
const calc = (
  baseMethod: HeatingBaseMethod,
  options: {
    units?: UnitInfo[];
    meters?: ReturnType<typeof metered>[];
    substitutions?: SubstitutionInput[];
    hotWater?: Parameters<typeof calculateHeating>[0]["hotWater"];
    supply?: Parameters<typeof calculateHeating>[0]["supply"];
  } = {},
) =>
  calculateHeating({
    totalHeatingCostsCents: 100_000,
    config: { consumptionShareBps: 7000, baseMethod },
    units: options.units ?? [
      unit("A", 60, null),
      unit("B", 40, 30),
      unit("C", 50, 0),
    ],
    consumptionMeters: options.meters ?? [metered("A", 700), metered("B", 300)],
    consumptionMethod: "heat_meter",
    periodStart: PERIOD.start,
    periodEnd: PERIOD.end,
    substitutions: options.substitutions,
    hotWater: options.hotWater,
    supply: options.supply,
  });

const row = (detail: ReturnType<typeof calc>, unitId: string) =>
  detail.perUnit.find((entry) => entry.unitId === unitId);

const centSum = (detail: ReturnType<typeof calc>) =>
  detail.perUnit.reduce((acc, entry) => acc + entry.totalCents, 0) +
  (detail.landlordBasicCostCents ?? 0) +
  (detail.landlordConsumptionCostCents ?? 0);

describe("Heizfläche 0 beim Maßstab beheizte Fläche", () => {
  it("trägt keine Grundkosten, braucht keinen Zähler und meldet den Hinweis", () => {
    const detail = calc("heated_area");

    // Grundkosten 30.000 Cent nach 60 / 30 / 0
    expect(row(detail, "A")?.basicCostCents).toBe(20_000);
    expect(row(detail, "B")?.basicCostCents).toBe(10_000);
    expect(row(detail, "C")).toMatchObject({
      areaSqm: 0,
      basicCostCents: 0,
      consumptionCostCents: 0,
      consumptionKwh: 0,
      totalCents: 0,
    });
    expect(centSum(detail)).toBe(100_000);
    expect(codes(detail)).not.toContain("consumptionMeterMissingHeating");
    expect(codes(detail)).toContain("heatingAreaZero");
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
  });

  it("lässt im Leerstand keinen Vermieteranteil daraus entstehen", () => {
    const detail = calc("heated_area", {
      units: [unit("A", 60, null), unit("B", 40, 30), unit("C", 50, 0, 0)],
    });

    expect(detail.landlordBasicCostCents ?? 0).toBe(0);
    expect(centSum(detail)).toBe(100_000);
  });

  it("sperrt, wenn alle Wohnungen Heizfläche 0 haben", () => {
    const detail = calc("heated_area", {
      units: [unit("A", 60, 0), unit("B", 40, 0)],
      meters: [],
    });

    expect(codes(detail)).toContain("heatingAreaNoAllocationBase");
    expect(codes(detail)).not.toContain("supplyNoParticipantsHeating");
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(true);
    for (const entry of detail.perUnit) {
      expect(Number.isFinite(entry.totalCents)).toBe(true);
    }
  });

  it("lässt den Vergleich je qm für die eigene Wohnung weg, der Durchschnitt bleibt", () => {
    const detail = calc("heated_area", {
      meters: [metered("A", 700), metered("B", 300), metered("C", 0)],
    });

    expect(averageUserComparison(detail, "C", PERIOD, PERIOD)).toBeNull();
    const forA = averageUserComparison(detail, "A", PERIOD, PERIOD);
    // (700 + 300 + 0) / (60 + 30 + 0)
    expect(forA?.rows[1]?.value.params?.value).toBe("11,1");
    expect(JSON.stringify(detail)).not.toMatch(/NaN|Infinity/u);
    expect(heatingDetailSchema.safeParse(detail).success).toBe(true);
  });
});

describe("Heizfläche 0 beim Maßstab Wohnfläche", () => {
  it("verteilt die Grundkosten nach Wohnfläche, ohne Zähler und ohne Hinweis", () => {
    const detail = calc("living_area");

    // 30.000 Cent nach 60 / 40 / 50
    expect(row(detail, "C")).toMatchObject({
      areaSqm: 50,
      basicCostCents: 10_000,
      consumptionCostCents: 0,
    });
    expect(centSum(detail)).toBe(100_000);
    expect(codes(detail)).not.toContain("consumptionMeterMissingHeating");
    expect(codes(detail)).not.toContain("heatingAreaZero");
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
  });

  it("lässt die Grundkosten im Leerstand beim Vermieter", () => {
    const detail = calc("living_area", {
      units: [unit("A", 60, null), unit("B", 40, 30), unit("C", 50, 0, 0)],
    });

    expect(detail.landlordBasicCostCents).toBe(10_000);
    expect(centSum(detail)).toBe(100_000);
  });

  it("rechnet die eigene Kennzahl mit der Wohnfläche und zählt sie im Durchschnitt mit", () => {
    const detail = calc("living_area", {
      meters: [metered("A", 700), metered("B", 300), metered("C", 0)],
    });

    const forC = averageUserComparison(detail, "C", PERIOD, PERIOD);
    expect(forC?.rows[0]?.value.params?.value).toBe("0,0");
    // (700 + 300 + 0) / (60 + 40 + 50)
    expect(forC?.rows[1]?.value.params?.value).toBe("6,7");
  });
});

describe("Heizfläche 0 mit Verbrauch", () => {
  it.each([
    "heated_area",
    "living_area",
  ] as const)("ist mit Zähler ohne Verbrauch zulässig, mit Verbrauch gesperrt (%s)", (baseMethod) => {
    const withoutConsumption = calc(baseMethod, {
      meters: [metered("A", 700), metered("B", 300), metered("C", 0)],
    });
    expect(codes(withoutConsumption)).not.toContain(
      "heatingAreaZeroWithConsumption",
    );
    expect(hasBlockingWarning({ heatingDetail: withoutConsumption })).toBe(
      false,
    );

    const withConsumption = calc(baseMethod, {
      meters: [metered("A", 700), metered("B", 300), metered("C", 50)],
    });
    expect(withConsumption.warnings).toContainEqual({
      code: "heatingAreaZeroWithConsumption",
      params: { unit: "C", unitId: "C" },
    });
    expect(hasBlockingWarning({ heatingDetail: withConsumption })).toBe(true);
  });

  it("sperrt auch bei einem Ersatzverbrauch größer 0", () => {
    const detail = calc("living_area", {
      meters: [
        metered("A", 700),
        metered("B", 300),
        { meter: meter("C"), readings: [reading(PERIOD.start, 0)] },
      ],
      substitutions: [substitutionFor("C")],
    });

    expect(codes(detail)).toContain("heatingAreaZeroWithConsumption");
  });

  it("ergibt beim Maßstab beheizte Fläche nach Gebäudedurchschnitt keinen Ersatzverbrauch", () => {
    // Ersatz = Verbrauch je qm x Grundkostenfläche, also 10 kWh/qm x 0 qm
    const detail = calc("heated_area", {
      meters: [
        metered("A", 700),
        metered("B", 300),
        { meter: meter("C"), readings: [reading(PERIOD.start, 0)] },
      ],
      substitutions: [substitutionFor("C")],
    });

    expect(row(detail, "C")?.consumptionKwh).toBe(0);
    expect(codes(detail)).not.toContain("heatingAreaZeroWithConsumption");
    expect(codes(detail)).not.toContain("substitutionComparisonInvalid");
    expect(hasBlockingWarning({ heatingDetail: detail })).toBe(false);
    expect(JSON.stringify(detail)).not.toMatch(/NaN|Infinity/u);
  });
});

/**
 * Erfassungsausfall für die ganze Wohnung, Ersatz 10 kWh je qm
 */
const substitutionFor = (unitId: string): SubstitutionInput => ({
  id: `sub-${unitId}`,
  unitId,
  affectedMeterIds: [meter(unitId).id],
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

describe("25-%-Grenze bei Heizfläche 0", () => {
  it.each([
    ["heated_area", 90],
    ["living_area", 150],
  ] as const)("zählt die Wohnung mit ihrer Grundkostenfläche zur Gesamtfläche (%s)", (baseMethod, totalAreaSqm) => {
    // Ausfall nur bei A (60 qm); C hat Heizfläche 0 und keinen Ausfall.
    const detail = calc(baseMethod, {
      meters: [
        { meter: meter("A"), readings: [reading(PERIOD.start, 0)] },
        metered("B", 300),
      ],
      substitutions: [substitutionFor("A")],
    });

    expect(detail.substitutionArea?.heating).toMatchObject({
      affectedAreaSqm: 60,
      totalAreaSqm,
    });
  });
});

describe("Heizfläche 0 und Warmwasser", () => {
  it("ändert nichts an der Zählerprüfung für Warmwasser", () => {
    const detail = calc("heated_area", {
      hotWater: {
        totalHeatEnergyKwh: 10_000,
        boilerHeatKwh: null,
        hotWaterVolumeM3: null,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [],
        unitMeters: ["A", "B"].map((unitId) => ({
          meter: meter(unitId, "water_hot"),
          readings: [reading(PERIOD.start, 0), reading(PERIOD.end, 10)],
        })),
      },
    });

    expect(detail.warnings).toContainEqual(
      expect.objectContaining({
        code: "consumptionMeterMissingHotWater",
        params: expect.objectContaining({ unitId: "C" }),
      }),
    );
    expect(codes(detail)).not.toContain("consumptionMeterMissingHeating");
  });
});

describe("Grundkostenfläche bei Heizfläche 0", () => {
  it("ist beim Maßstab beheizte Fläche 0, sonst die Wohnfläche", () => {
    const zero = unit("C", 50, 0);

    expect(baseCostAreaFor("heating", zero, "heated_area")).toBe(0);
    expect(baseCostAreaFor("heating", zero, "living_area")).toBe(50);
    expect(baseCostAreaFor("hot_water", zero, "heated_area")).toBe(50);
    expect(baseCostAreaFor("heating", unit("A", 60, null), "heated_area")).toBe(
      60,
    );
  });
});

describe("Schema der Wohnung", () => {
  const base = {
    buildingId: "0198a2b0-0000-7000-8000-000000000001",
    name: "EG",
    areaSqm: 60,
  };

  it("lässt Heizfläche 0 zu und weist negative Werte und Wohnfläche 0 ab", () => {
    expect(
      unitCreateSchema.safeParse({ ...base, heatingAreaSqm: 0 }).success,
    ).toBe(true);
    expect(
      unitCreateSchema.safeParse({ ...base, heatingAreaSqm: -1 }).success,
    ).toBe(false);
    expect(unitCreateSchema.safeParse({ ...base, areaSqm: 0 }).success).toBe(
      false,
    );
  });

  it("nimmt im Formular 0 an und weist negative Werte ab", () => {
    const form = {
      buildingId: base.buildingId,
      name: "EG",
      unitNumber: "",
      areaSqm: "60",
    };

    expect(
      unitFormSchema.safeParse({
        ...form,
        heatingAreaDiffers: true,
        heatingAreaSqm: "0",
      }).success,
    ).toBe(true);
    expect(
      unitFormSchema.safeParse({
        ...form,
        heatingAreaDiffers: true,
        heatingAreaSqm: "-1",
      }).success,
    ).toBe(false);
    expect(
      unitFormSchema.safeParse({
        ...form,
        areaSqm: "0",
        heatingAreaDiffers: false,
        heatingAreaSqm: "",
      }).success,
    ).toBe(false);
  });
});

describe("Heizfläche 0 und Versorgung", () => {
  it("bleibt voll versorgt in perUnit, eine nicht versorgte Wohnung fehlt dort", () => {
    const year = [PERIOD];
    const detail = calc("heated_area", {
      units: [
        unit("A", 60, null),
        unit("B", 40, 30),
        unit("C", 50, 0),
        unit("D", 30, null),
      ],
      supply: {
        exclusions: [
          {
            unitId: "D",
            scope: "heating",
            validFrom: "2020-01-01",
            validUntil: null,
          },
        ],
        occupiedSpansByUnit: new Map([
          ["A", year],
          ["B", year],
          ["C", year],
          ["D", year],
        ]),
      },
    });

    expect(detail.perUnit.map((entry) => entry.unitId)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(row(detail, "C")?.areaSqm).toBe(0);
    const supply = detail.supply?.heating ?? [];
    expect(supply.find((entry) => entry.unitId === "C")).toMatchObject({
      suppliedDays: 365,
    });
    expect(supply.find((entry) => entry.unitId === "D")).toMatchObject({
      suppliedDays: 0,
    });
  });
});

describe("Betriebskosten nach Heizfläche", () => {
  const translate = createTranslate(createI18nSync());
  const period = { start: "2025-01-01", end: "2025-12-31" };
  const costType = (allocationKey: "per_heating_area" | "per_living_area") => ({
    id: allocationKey,
    name: allocationKey,
    allocationKey,
    meterIds: [],
    costs: [
      {
        id: `c-${allocationKey}`,
        costTypeId: allocationKey,
        allocationKey,
        name: allocationKey,
        amountCents: 10_000,
        periodStart: period.start,
        periodEnd: period.end,
      },
    ],
  });
  const statementFor = (
    units: UnitInfo[],
    targetUnitId: string,
    allocationKey: "per_heating_area" | "per_living_area" = "per_heating_area",
  ) =>
    calculateStatement({
      period,
      units,
      targetTenantId: "t",
      targetUnitId,
      costTypes: [costType(allocationKey)],
      waterMeters: [],
      totalAdvancesCents: 0,
      translate,
    });

  it("gibt der Wohnung mit Heizfläche 0 keinen Anteil, der Rest geht an die anderen", () => {
    const units = [unit("A", 60, null), unit("C", 50, 0)];

    expect(statementFor(units, "C").lines[0]?.tenantAmountCents).toBe(0);
    expect(statementFor(units, "A").lines[0]?.tenantAmountCents).toBe(10_000);
    expect(statementFor(units, "A").costWarnings).toBeUndefined();
  });

  it("sperrt, wenn die Fläche aller Wohnungen zusammen 0 ist", () => {
    const result = statementFor([unit("A", 60, 0), unit("C", 50, 0)], "A");

    expect(result.lines[0]?.tenantAmountCents).toBe(0);
    expect(result.lines[0]?.landlordAmountCents).toBe(0);
    expect(result.costWarnings).toEqual([
      { code: "costAllocationBaseZero", params: { label: "per_heating_area" } },
    ]);
    expect(hasBlockingWarning(result)).toBe(true);
  });

  it("sperrt auch bei einer Gutschrift ohne Verteilungsgrundlage", () => {
    const credit = costType("per_heating_area");
    const result = calculateStatement({
      period,
      units: [unit("A", 60, 0), unit("C", 50, 0)],
      targetTenantId: "t",
      targetUnitId: "A",
      costTypes: [
        {
          ...credit,
          costs: credit.costs.map((cost) => ({ ...cost, amountCents: -5000 })),
        },
      ],
      waterMeters: [],
      totalAdvancesCents: 0,
      translate,
    });

    expect(result.costWarnings?.map((warning) => warning.code)).toEqual([
      "costAllocationBaseZero",
    ]);
  });

  it.each([
    "heated_area",
    "living_area",
  ] as const)("behält den Heizungsteil im Mieterdokument (%s)", (baseMethod) => {
    const heatingDetail = calc(baseMethod);
    const result = calculateStatement({
      period: PERIOD,
      units: [unit("A", 60, null), unit("B", 40, 30), unit("C", 50, 0)],
      targetTenantId: "t",
      targetUnitId: "C",
      costTypes: [costType("per_living_area")],
      waterMeters: [],
      heatingDetail,
      totalAdvancesCents: 0,
      translate,
    });
    const heatingCents = result.lines
      .filter((line) => line.allocationKey === "heating_ordinance")
      .reduce((acc, line) => acc + line.tenantAmountCents, 0);

    expect(
      result.lines.some((line) => line.allocationKey === "heating_ordinance"),
    ).toBe(true);
    // Grundkosten: 0 bei beheizter Fläche, 10.000 Cent nach Wohnfläche
    expect(heatingCents).toBe(baseMethod === "heated_area" ? 0 : 10_000);
  });

  it("parst Ergebnisse mit und ohne costWarnings", () => {
    const blocked = statementFor([unit("A", 60, 0), unit("C", 50, 0)], "A");
    const { costWarnings: _omitted, ...old } = blocked;

    expect(statementResultSchema.safeParse(blocked).success).toBe(true);
    expect(statementResultSchema.safeParse(old).success).toBe(true);
  });

  it("lässt Kosten nach Wohnfläche unberührt", () => {
    const result = statementFor(
      [unit("A", 60, 0), unit("C", 50, 0)],
      "A",
      "per_living_area",
    );

    expect(result.costWarnings).toBeUndefined();
    expect(hasBlockingWarning(result)).toBe(false);
  });
});
