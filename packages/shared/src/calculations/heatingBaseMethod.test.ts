import { describe, expect, it } from "vitest";
import type {
  HeatingBaseMethod,
  MeterInfo,
  ReadingPoint,
  UnitInfo,
} from "../index.js";
import { heatingSettingsWriteSchema } from "../schemas/heating.js";
import { calculateHeating } from "./heating.js";
import {
  heatingAreaColumnLabelKey,
  heatingBaseMethodOf,
  heatingColumnFootnotes,
} from "./heatingDisplay.js";

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

const heatMeter = (unitId: string): MeterInfo => ({
  id: `wmz-${unitId}`,
  type: "heat_meter",
  role: "unit",
  unitId,
  label: `WMZ ${unitId}`,
  measurementUnit: "kwh",
  validFrom: "1900-01-01",
  validUntil: null,
});

const reading = (date: string, value: number): ReadingPoint => ({
  date,
  value,
  isCumulative: true,
  isEstimated: false,
});

const metered = (unitId: string, kwh: number) => ({
  meter: heatMeter(unitId),
  readings: [reading("2025-01-01", 0), reading("2025-12-31", kwh)],
});

/**
 * EG 80 qm mit 60 qm Heizfläche, OG 120 qm ohne Angabe. 10.000 Cent,
 * 30 % Grundkosten = 3.000 Cent.
 */
const calculate = (
  baseMethod: HeatingBaseMethod,
  options: { units?: UnitInfo[]; withMeters?: boolean } = {},
) =>
  calculateHeating({
    totalHeatingCostsCents: 10_000,
    config: { consumptionShareBps: 7000, baseMethod },
    units: options.units ?? [unit("EG", 80, 60), unit("OG", 120, null)],
    consumptionMethod: "heat_meter",
    consumptionMeters:
      options.withMeters === false
        ? []
        : [metered("EG", 100), metered("OG", 300)],
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  });

const row = (result: ReturnType<typeof calculate>, unitId: string) =>
  result.perUnit.find((entry) => entry.unitId === unitId);

const centSum = (result: ReturnType<typeof calculate>) =>
  result.perUnit.reduce((acc, entry) => acc + entry.totalCents, 0) +
  (result.landlordBasicCostCents ?? 0) +
  (result.landlordConsumptionCostCents ?? 0);

describe("Grundkostenmaßstab der Heizung", () => {
  it("verteilt die Grundkosten nach Wohnfläche oder nach Heizfläche", () => {
    const living = calculate("living_area");
    const heated = calculate("heated_area");

    // Wohnfläche 80 / 200, Heizfläche 60 / 180
    expect(row(living, "EG")?.basicCostCents).toBe(1200);
    expect(row(living, "OG")?.basicCostCents).toBe(1800);
    expect(row(heated, "EG")?.basicCostCents).toBe(1000);
    expect(row(heated, "OG")?.basicCostCents).toBe(2000);

    expect(row(living, "EG")?.areaSqm).toBe(80);
    expect(row(heated, "EG")?.areaSqm).toBe(60);
    expect(living.baseMethod).toBe("living_area");
    expect(heated.baseMethod).toBe("heated_area");
    expect(living.heatingAreaDiffersFromLivingArea).toBe(false);
    expect(heated.heatingAreaDiffersFromLivingArea).toBe(true);
    expect(centSum(living)).toBe(10_000);
    expect(centSum(heated)).toBe(10_000);
  });

  it("liefert ohne eingetragene Heizflächen bei beiden Maßstäben dasselbe", () => {
    const units = [unit("EG", 80, null), unit("OG", 120, null)];
    const living = calculate("living_area", { units });
    const heated = calculate("heated_area", { units });

    expect(living.perUnit).toEqual(heated.perUnit);
  });

  it("lässt den Leerstand bei beiden Maßstäben beim Vermieter", () => {
    const units = [unit("EG", 80, 60, 0), unit("OG", 120, null)];

    const living = calculate("living_area", { units });
    expect(living.landlordBasicCostCents).toBe(1200);
    expect(centSum(living)).toBe(10_000);

    const heated = calculate("heated_area", { units });
    expect(heated.landlordBasicCostCents).toBe(1000);
    expect(centSum(heated)).toBe(10_000);
  });

  it("verteilt ohne Messung auch den Verbrauchsanteil nach dem Maßstab", () => {
    const living = calculate("living_area", { withMeters: false });
    const heated = calculate("heated_area", { withMeters: false });

    // 7.000 Cent Verbrauchsanteil: 80 / 200 bzw. 60 / 180
    expect(row(living, "EG")?.consumptionCostCents).toBe(2800);
    expect(row(heated, "EG")?.consumptionCostCents).toBe(2333);
    expect(living.warnings?.map((warning) => warning.code)).toContain(
      "consumptionFallbackNoHeatMetersLivingArea",
    );
    expect(heated.warnings?.map((warning) => warning.code)).toContain(
      "consumptionFallbackNoHeatMeters",
    );
  });
});

describe("Anzeige des Grundkostenmaßstabs aus dem Snapshot", () => {
  it("nimmt für alte Snapshots ohne Angabe die Heizfläche", () => {
    expect(heatingBaseMethodOf({})).toBe("heated_area");
    expect(heatingAreaColumnLabelKey({})).toBe(
      "statements.pdf.heating.heatingArea",
    );
    expect(heatingAreaColumnLabelKey({ baseMethod: "living_area" })).toBe(
      "statements.pdf.heating.livingArea",
    );
  });

  it("benennt die Fläche in den Fußnoten nach dem Maßstab", () => {
    const living = calculate("living_area", { withMeters: false });
    const heated = calculate("heated_area", { withMeters: false });
    const fallbackKey = (detail: ReturnType<typeof calculate>) =>
      heatingColumnFootnotes(detail, false, 100).find(
        (note) => note.key === "areaFallback",
      )?.label.key;

    expect(fallbackKey(living)).toBe(
      "statements.pdf.heating.consumptionDistributionLivingArea",
    );
    expect(fallbackKey(heated)).toBe(
      "statements.pdf.heating.consumptionDistributionHeatingArea",
    );
    expect(
      heatingColumnFootnotes(living, false, 100).some(
        (note) => note.key === "heatingArea",
      ),
    ).toBe(false);
  });
});

describe("Schema der Heizkostenkonfiguration", () => {
  it("lehnt den früheren Wert area ab", () => {
    const base = {
      mode: "internal",
      validFrom: "2026-01-01",
      validTo: null,
      baseSharePercent: 30,
      consumptionSharePercent: 70,
      consumptionMethod: "heat_meter",
      prorationMethod: "linear",
      heatingType: "central_without_hot_water",
      fuelType: "gas",
      hotWaterMeterId: null,
      hotWaterSupplyTemperatureCelsius: 60,
      co2CostShareEnabled: true,
    };

    expect(
      heatingSettingsWriteSchema.safeParse({ ...base, baseMethod: "area" })
        .success,
    ).toBe(false);
    expect(
      heatingSettingsWriteSchema.safeParse({
        ...base,
        baseMethod: "living_area",
      }).success,
    ).toBe(true);
  });
});
