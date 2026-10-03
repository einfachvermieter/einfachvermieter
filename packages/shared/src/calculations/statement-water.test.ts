import { createI18nSync, createTranslate } from "@einfachvermieter/i18n";
import { describe, expect, it } from "vitest";
import type { MeterInfo, UnitInfo } from "../types/index.js";
import {
  calculateStatement,
  type StatementCalculationInput,
  waterFootnoteMeters,
} from "./index.js";
import type { MeterBundle } from "./virtualMeter.js";

const translate = createTranslate(createI18nSync());

const period = { start: "2025-01-01", end: "2025-12-31" };

const unit = (id: string, areaSqm: number): UnitInfo => ({
  id,
  name: id,
  areaSqm,
  occupantCount: 1,
  personDays: 365,
  occupiedDays: 365,
  periodDays: 365,
});

const waterMeter = (
  id: string,
  role: MeterInfo["role"],
  unitId: string | null,
  endValue: number,
  type: MeterInfo["type"] = "water_cold",
): MeterBundle => ({
  meter: {
    id,
    type,
    role,
    unitId,
    label: id,
    measurementUnit: "m3",
    validFrom: "1900-01-01",
    validUntil: null,
  },
  readings: [
    { date: period.start, value: 0, isCumulative: true, isEstimated: false },
    {
      date: period.end,
      value: endValue,
      isCumulative: true,
      isEstimated: false,
    },
  ],
  differenceConfig: null,
});

const costType = (id: string, meterIds: string[]) => ({
  id,
  name: id,
  allocationKey: "per_consumption_m3" as const,
  meterIds,
  costs: [
    {
      id: `c-${id}`,
      costTypeId: id,
      allocationKey: "per_consumption_m3" as const,
      name: id,
      amountCents: 100_000,
      periodStart: period.start,
      periodEnd: period.end,
    },
  ],
});

/**
 * Hauptzähler 100 m3: EG 60, OG 20, Garten 20. Frisch- und Schmutzwasser
 * kosten je 1.000 €.
 */
const input = (
  gardenUnitId: string | null,
  assignments: { fresh: string[]; waste: string[] },
): StatementCalculationInput => ({
  period,
  units: [unit("u-eg", 60), unit("u-og", 40)],
  targetTenantId: "t-eg",
  targetUnitId: "u-eg",
  costTypes: [
    costType("Frischwasser", assignments.fresh),
    costType("Schmutzwasser", assignments.waste),
  ],
  waterMeters: [
    waterMeter("m-main", "main", null, 100),
    waterMeter("m-eg", "unit", "u-eg", 60),
    waterMeter("m-og", "unit", "u-og", 20),
    waterMeter("Garten", "common", gardenUnitId, 20),
  ],
  totalAdvancesCents: 0,
  translate,
});

const assigned = {
  fresh: ["m-eg", "m-og", "Garten"],
  waste: ["m-eg", "m-og"],
};

describe("calculateStatement mit Zählerzuordnung beim Wasser", () => {
  it("rechnet ohne Zuordnung mit allen Wasserzählern", () => {
    const result = calculateStatement(input(null, { fresh: [], waste: [] }));

    expect(result.lines.map((line) => line.tenantAmountCents)).toEqual([
      75_000, 75_000,
    ]);
    expect(result.waterDetail?.warnings).toEqual([
      { code: "commonConsumptionUnallocated", params: { label: "Garten" } },
    ]);
  });

  it("zählt den Garten einer Wohnung nur beim Frischwasser", () => {
    const result = calculateStatement(input("u-og", assigned));

    // Frischwasser 60 von 100 m3, Schmutzwasser 60 von 80 m3
    expect(result.lines.map((line) => line.tenantAmountCents)).toEqual([
      60_000, 75_000,
    ]);
    expect(result.waterDetail?.warnings).toBeUndefined();
  });

  it("nennt in den Fußnoten je Kostenart nur die zugeordneten Zähler", () => {
    const withGarden = waterFootnoteMeters(
      calculateStatement({ ...input("u-eg", assigned) }),
    );

    expect(withGarden.fresh.map((meter) => meter.label)).toEqual([
      "m-eg",
      "Garten",
    ]);
    expect(withGarden.waste?.map((meter) => meter.label)).toEqual(["m-eg"]);

    // Gleiche Zähler: beim Schmutzwasser bleibt der Verweis aufs Frischwasser
    const unassigned = waterFootnoteMeters(
      calculateStatement(input("u-eg", { fresh: [], waste: [] })),
    );

    expect(unassigned.fresh).toHaveLength(2);
    expect(unassigned.waste).toBeNull();
  });

  it("zieht den Garten für alle vorweg ab und verteilt ihn nach Wohnfläche", () => {
    const result = calculateStatement(input(null, assigned));

    expect(
      result.lines.map((line) => [
        line.costTypeName,
        line.allocationKey,
        line.totalAmountCents,
        line.tenantAmountCents,
      ]),
    ).toEqual([
      // 80 von 100 m3 nach Verbrauch, davon EG 60 von 80
      ["Frischwasser", "per_consumption_m3", 80_000, 60_000],
      // 20 von 100 m3 nach Wohnfläche, EG 60 von 100 m²
      ["Frischwasser, Anteil Garten", "per_living_area", 20_000, 12_000],
      ["Schmutzwasser", "per_consumption_m3", 100_000, 75_000],
    ]);
    expect(result.waterDetail?.warnings).toBeUndefined();
  });

  it("meldet einen zugeordneten Garten für alle nicht als fehlend", () => {
    const result = calculateStatement(input(null, assigned));

    expect(result.waterDetail?.warnings).toBeUndefined();
  });

  it("warnt bei einer Wohnung ohne zugeordneten Zähler", () => {
    const result = calculateStatement(
      input(null, { fresh: ["m-eg"], waste: [] }),
    );

    expect(result.waterDetail?.warnings).toContainEqual({
      code: "unitWithoutAssignedMeter",
      params: { label: "u-og", costTypeName: "Frischwasser" },
    });
  });
});

/**
 * Hauptzähler 100 m3: EG kalt 40 + warm 20, OG kalt 30 + warm 10. Der
 * Kaltwasserzähler misst nur die Kaltwasserleitung.
 */
const hotWaterInput = (meterIds: string[]): StatementCalculationInput => ({
  period,
  units: [unit("u-eg", 60), unit("u-og", 40)],
  targetTenantId: "t-eg",
  targetUnitId: "u-eg",
  costTypes: [costType("Frischwasser", meterIds)],
  waterMeters: [
    waterMeter("m-main", "main", null, 100),
    waterMeter("kalt-eg", "unit", "u-eg", 40),
    waterMeter("kalt-og", "unit", "u-og", 30),
    waterMeter("warm-eg", "unit", "u-eg", 20, "water_hot"),
    waterMeter("warm-og", "unit", "u-og", 10, "water_hot"),
  ],
  totalAdvancesCents: 0,
  translate,
});

describe("calculateStatement mit Kalt- und Warmwasserzählern", () => {
  it("zählt ohne Zuordnung Kalt- und Warmwasser, ohne Warnung", () => {
    const result = calculateStatement(hotWaterInput([]));

    expect(result.lines[0]?.tenantBase).toBe(60);
    expect(result.lines[0]?.totalBase).toBe(100);
    expect(result.lines[0]?.tenantAmountCents).toBe(60_000);
    expect(result.waterDetail?.warnings).toBeUndefined();
  });

  it("rechnet mit vollständiger Zuordnung wie ohne", () => {
    const result = calculateStatement(
      hotWaterInput(["kalt-eg", "kalt-og", "warm-eg", "warm-og"]),
    );

    expect(result.lines[0]?.tenantBase).toBe(60);
    expect(result.lines[0]?.totalBase).toBe(100);
    expect(result.lines[0]?.tenantAmountCents).toBe(60_000);
    expect(result.waterDetail?.warnings).toBeUndefined();
  });

  it("warnt bei vergessenen Warmwasserzählern", () => {
    const result = calculateStatement(hotWaterInput(["kalt-eg", "kalt-og"]));

    // Nur Kaltwasser: EG 40 von 70 m3
    expect(result.lines[0]?.tenantBase).toBe(40);
    expect(result.lines[0]?.totalBase).toBe(70);
    expect(result.waterDetail?.warnings).toEqual([
      { code: "waterMeterUnassigned", params: { label: "warm-eg" } },
      { code: "waterMeterUnassigned", params: { label: "warm-og" } },
    ]);
  });
});
