import { describe, expect, it } from "vitest";
import type { HeatingDetail, Period } from "../types/index.js";
import {
  buildEnergyComparison,
  type EnergyComparisonPeriodInput,
} from "./energyComparison.js";

const fullYear2024: Period = { start: "2024-01-01", end: "2024-12-31" };
const fullYear2025: Period = { start: "2025-01-01", end: "2025-12-31" };

const unitRow = (consumptionKwh: number) => ({
  unitId: "a",
  unitName: "WE 1",
  consumptionKwh,
  consumptionCostCents: 0,
  areaSqm: 50,
  basicCostCents: 0,
  totalCents: 0,
});

const periodInput = (
  consumptionKwh: number,
  tenantPeriod: Period,
  overrides: Partial<EnergyComparisonPeriodInput["detail"]> = {},
): EnergyComparisonPeriodInput => ({
  detail: {
    mode: "internal",
    consumptionMethod: "heat_meter",
    perUnit: [unitRow(consumptionKwh)],
    ...overrides,
  },
  tenantPeriod,
});

const hotWaterDetail = (
  hotWaterHeatKwh: number,
  ownM3: number,
  totalM3: number,
): NonNullable<HeatingDetail["hotWaterDetail"]> => ({
  method: "estimated",
  totalHeatEnergyKwh: 10_000,
  hotWaterHeatKwh,
  hotWaterShareBps: 2000,
  hotWaterPotCents: 0,
  hotWaterVolumeM3: totalM3,
  consumptionShareBps: 7000,
  consumptionPortionCents: 0,
  basicPortionCents: 0,
  consumptionDistributionMethod: "consumption",
  perUnit: [
    {
      unitId: "a",
      unitName: "WE 1",
      hotWaterM3: ownM3,
      consumptionCostCents: 0,
      areaSqm: 50,
      basicCostCents: 0,
      totalCents: 0,
    },
  ],
  landlordBasicCostCents: 0,
  landlordConsumptionCostCents: 0,
});

describe("buildEnergyComparison (§ 6a Abs. 3 Nr. 5 HeizkostenV)", () => {
  it("volle Kalenderjahre bleiben unverändert (Gradtags-Promille = 1.000)", () => {
    const result = buildEnergyComparison(
      "a",
      periodInput(1000, fullYear2025),
      periodInput(800, fullYear2024),
    );
    expect(result).toEqual({
      consumptionUnit: "kwh",
      includesHotWater: false,
      current: { period: fullYear2025, normalizedConsumption: 1000 },
      previous: { period: fullYear2024, normalizedConsumption: 800 },
    });
  });

  it("rechnet unterjährige Zeiträume über die Gradtagszahlen aufs Normjahr hoch", () => {
    // Jul-Dez = 14+13+30+80+120+160 = 417 ‰ des Normjahres.
    const halfYear: Period = { start: "2025-07-01", end: "2025-12-31" };
    const result = buildEnergyComparison("a", periodInput(417, halfYear));
    expect(result?.current.normalizedConsumption).toBeCloseTo(1000, 6);
  });

  it("verwirft die Vorperiode bei anderer Messmethode (Einheiten-Mix)", () => {
    const result = buildEnergyComparison(
      "a",
      periodInput(1000, fullYear2025, {
        consumptionMethod: "heat_cost_allocator",
      }),
      periodInput(800, fullYear2024),
    );
    expect(result?.consumptionUnit).toBe("hkv_units");
    expect(result?.previous).toBeUndefined();
  });

  it("addiert Warmwasser-Energie, wenn beide Perioden sie hergeben", () => {
    // Eigener WW-Anteil: 2.000 kWh x 30/100 m³ = 600 kWh (volles Jahr).
    const result = buildEnergyComparison(
      "a",
      periodInput(1000, fullYear2025, {
        hotWaterDetail: hotWaterDetail(2000, 30, 100),
      }),
      periodInput(800, fullYear2024, {
        hotWaterDetail: hotWaterDetail(1800, 30, 100),
      }),
    );
    expect(result?.includesHotWater).toBe(true);
    expect(result?.current.normalizedConsumption).toBeCloseTo(1600, 6);
    expect(result?.previous?.normalizedConsumption).toBeCloseTo(1340, 6);
  });

  it("lässt Warmwasser weg, wenn die Vorperiode keins ermitteln kann", () => {
    const result = buildEnergyComparison(
      "a",
      periodInput(1000, fullYear2025, {
        hotWaterDetail: hotWaterDetail(2000, 30, 100),
      }),
      periodInput(800, fullYear2024),
    );
    expect(result?.includesHotWater).toBe(false);
    expect(result?.current.normalizedConsumption).toBe(1000);
    expect(result?.previous?.normalizedConsumption).toBe(800);
  });

  it("bereinigt beide Seiten mit ihren Klimafaktoren", () => {
    const result = buildEnergyComparison(
      "a",
      { ...periodInput(1000, fullYear2025), climateFactor: 1.28 },
      { ...periodInput(800, fullYear2024), climateFactor: 1.35 },
    );
    expect(result?.current.normalizedConsumption).toBeCloseTo(1280, 6);
    expect(result?.current.climateFactor).toBe(1.28);
    expect(result?.previous?.normalizedConsumption).toBeCloseTo(1080, 6);
    expect(result?.previous?.climateFactor).toBe(1.35);
  });

  it("lässt beide Seiten unbereinigt, wenn nur eine einen Faktor hat", () => {
    const result = buildEnergyComparison(
      "a",
      { ...periodInput(1000, fullYear2025), climateFactor: 1.28 },
      periodInput(800, fullYear2024),
    );
    expect(result?.current.normalizedConsumption).toBe(1000);
    expect(result?.current.climateFactor).toBeUndefined();
    expect(result?.previous?.normalizedConsumption).toBe(800);
    expect(result?.previous?.climateFactor).toBeUndefined();
  });

  it("bereinigt nur die Heizung, Warmwasser bleibt unbereinigt", () => {
    const result = buildEnergyComparison(
      "a",
      {
        ...periodInput(1000, fullYear2025, {
          hotWaterDetail: hotWaterDetail(2000, 30, 100),
        }),
        climateFactor: 1.2,
      },
      {
        ...periodInput(800, fullYear2024, {
          hotWaterDetail: hotWaterDetail(1800, 30, 100),
        }),
        climateFactor: 1.5,
      },
    );
    // Heizung 1.000 x 1,2 = 1.200 plus Warmwasser 600 unbereinigt.
    expect(result?.current.normalizedConsumption).toBeCloseTo(1800, 6);
    // Heizung 800 x 1,5 = 1.200 plus Warmwasser 540 unbereinigt.
    expect(result?.previous?.normalizedConsumption).toBeCloseTo(1740, 6);
  });

  it("entfällt ohne gemessenen Verbrauch der aktuellen Periode", () => {
    expect(
      buildEnergyComparison(
        "a",
        periodInput(1000, fullYear2025, { mode: "external" }),
      ),
    ).toBeUndefined();
    expect(
      buildEnergyComparison(
        "a",
        periodInput(1000, fullYear2025, {
          consumptionDistributionMethod: "heating_area",
        }),
      ),
    ).toBeUndefined();
    expect(
      buildEnergyComparison("unbekannt", periodInput(1000, fullYear2025)),
    ).toBeUndefined();
  });
});
