import { describe, expect, it } from "vitest";
import type { CalcWarning, MeterInfo, ReadingPoint } from "../types/index.js";
import { computeMeterConsumption, type MeterBundle } from "./virtualMeter.js";

const physical = (
  id: string,
  role: MeterInfo["role"],
  readings: ReadingPoint[],
  validity: { validFrom?: string; validUntil?: string | null } = {},
): MeterBundle => ({
  meter: {
    id,
    type: "water_cold",
    role,
    unitId: null,
    label: id,
    measurementUnit: "m3",
    validFrom: validity.validFrom ?? "1900-01-01",
    validUntil: validity.validUntil ?? null,
  },
  readings,
});

const virtualMeter = (
  id: string,
  baseMeterId: string,
  subtractedMeterIds: string[],
  validity: { validFrom?: string; validUntil?: string | null } = {},
): MeterBundle => ({
  meter: {
    id,
    type: "water_cold",
    role: "virtual_difference",
    unitId: null,
    label: id,
    measurementUnit: "m3",
    validFrom: validity.validFrom ?? "1900-01-01",
    validUntil: validity.validUntil ?? null,
  },
  readings: [],
  differenceConfig: { baseMeterId, subtractedMeterIds },
});

const reading = (date: string, value: number): ReadingPoint => ({
  date,
  value,
  isCumulative: true,
  isEstimated: false,
});

const bundleMap = (...bundles: MeterBundle[]) =>
  new Map(bundles.map((bundle) => [bundle.meter.id, bundle]));

describe("computeMeterConsumption", () => {
  it("liefert Verbrauch eines physischen Zählers über Interpolation", () => {
    const bundles = bundleMap(
      physical("main", "main", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 100),
      ]),
    );
    expect(
      computeMeterConsumption("main", bundles, "2025-01-01", "2025-12-31"),
    ).toBe(100);
  });

  it("Differenzzähler: Basis − eine Subtraktion", () => {
    const bundles = bundleMap(
      physical("main", "main", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 200),
      ]),
      physical("a", "unit", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 80),
      ]),
      virtualMeter("b", "main", ["a"]),
    );
    expect(
      computeMeterConsumption("b", bundles, "2025-01-01", "2025-12-31"),
    ).toBe(120);
  });

  it("Differenzzähler: Basis − N Subtraktionen", () => {
    const bundles = bundleMap(
      physical("main", "main", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 200),
      ]),
      physical("a", "unit", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 80),
      ]),
      physical("waschmaschine", "common", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 25),
      ]),
      virtualMeter("b", "main", ["a", "waschmaschine"]),
    );
    expect(
      computeMeterConsumption("b", bundles, "2025-01-01", "2025-12-31"),
    ).toBe(95);
  });

  it("Verkettete Differenzzähler werden rekursiv aufgelöst", () => {
    const bundles = bundleMap(
      physical("main", "main", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 300),
      ]),
      physical("a", "unit", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 100),
      ]),
      // virt1 = main − a = 200
      virtualMeter("virt1", "main", ["a"]),
      physical("c", "unit", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 60),
      ]),
      // virt2 = virt1 − c = 200 − 60 = 140
      virtualMeter("virt2", "virt1", ["c"]),
    );
    expect(
      computeMeterConsumption("virt2", bundles, "2025-01-01", "2025-12-31"),
    ).toBe(140);
  });

  it("wirft bei zyklischer Verkettung", () => {
    const bundles = bundleMap(
      physical("anchor", "main", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 100),
      ]),
      virtualMeter("a", "anchor", ["b"]),
      virtualMeter("b", "anchor", ["a"]),
    );
    expect(() =>
      computeMeterConsumption("a", bundles, "2025-01-01", "2025-12-31"),
    ).toThrow(/differenceMeterCyclic/u);
  });

  it("wirft bei fehlender Konfiguration eines Differenzzählers", () => {
    const bundles = bundleMap({
      meter: {
        id: "broken",
        type: "water_cold",
        role: "virtual_difference",
        unitId: null,
        label: "broken",
        measurementUnit: "m3",
        validFrom: "1900-01-01",
        validUntil: null,
      },
      readings: [],
      differenceConfig: null,
    });
    expect(() =>
      computeMeterConsumption("broken", bundles, "2025-01-01", "2025-12-31"),
    ).toThrow(/differenceMeterNoConfig/u);
  });

  it("klemmt die Periode auf die Gültigkeit des Zählers", () => {
    // Zähler nur gültig Q2 (Apr-Jun). Verbrauch wird auf [Apr 1, Jun 30]
    // geklemmt - Q1 und Q3+ ignoriert.
    const bundles = bundleMap(
      physical(
        "m",
        "unit",
        [reading("2025-04-01", 0), reading("2025-06-30", 50)],
        { validFrom: "2025-04-01", validUntil: "2025-06-30" },
      ),
    );
    expect(
      computeMeterConsumption("m", bundles, "2025-01-01", "2025-12-31"),
    ).toBe(50);
  });

  it("Differenzzähler-Gültigkeit propagiert auf Basis und Subtraktionen", () => {
    // Differenzzähler valid Apr-Jun. Basis/Sub-Zähler haben breitere
    // Gültigkeit, werden aber auf die Differenzzähler-Periode geklemmt.
    const bundles = bundleMap(
      physical("main", "main", [
        reading("2025-01-01", 0),
        reading("2025-04-01", 90),
        reading("2025-06-30", 180),
        reading("2025-12-31", 360),
      ]),
      physical("a", "unit", [
        reading("2025-01-01", 0),
        reading("2025-04-01", 30),
        reading("2025-06-30", 60),
        reading("2025-12-31", 120),
      ]),
      virtualMeter("b", "main", ["a"], {
        validFrom: "2025-04-01",
        validUntil: "2025-06-30",
      }),
    );
    // Apr-Jun: main = 180 − 90 = 90, a = 60 − 30 = 30, b = 60.
    expect(
      computeMeterConsumption("b", bundles, "2025-01-01", "2025-12-31"),
    ).toBe(60);
  });

  it("liefert 0 wenn die Statement-Periode keinen Schnitt mit der Gültigkeit hat", () => {
    const bundles = bundleMap(
      physical(
        "m",
        "unit",
        [reading("2024-01-01", 0), reading("2024-12-31", 50)],
        { validUntil: "2024-12-31" },
      ),
    );
    expect(
      computeMeterConsumption("m", bundles, "2025-01-01", "2025-12-31"),
    ).toBe(0);
  });

  it("klemmt negativen Differenzverbrauch auf 0 und warnt", () => {
    // Subtraktionszähler (90) > Basiszähler (50) -> Differenz wäre −40.
    const bundles = bundleMap(
      physical("main", "main", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 50),
      ]),
      physical("a", "unit", [
        reading("2025-01-01", 0),
        reading("2025-12-31", 90),
      ]),
      virtualMeter("b", "main", ["a"]),
    );
    const warnings: CalcWarning[] = [];
    const result = computeMeterConsumption(
      "b",
      bundles,
      "2025-01-01",
      "2025-12-31",
      undefined,
      { warnings },
    );
    expect(result).toBe(0);
    expect(warnings).toContainEqual({
      code: "differenceMeterNegative",
      params: { label: "b" },
    });
  });

  it("wirft bei unbekanntem Zähler", () => {
    const bundles = bundleMap();
    expect(() =>
      computeMeterConsumption("missing", bundles, "2025-01-01", "2025-12-31"),
    ).toThrow(/Meter not found/u);
  });
});
