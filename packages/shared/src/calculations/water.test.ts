import { describe, expect, it } from "vitest";
import type { MeterInfo, ReadingPoint, UnitInfo } from "../types/index.js";
import type { DifferenceConfigInput } from "./virtualMeter.js";
import { calculateWater, type WaterMeterBundle } from "./water.js";

const unitEg: UnitInfo = {
  id: "unit-eg",
  name: "EG",
  areaSqm: 80,
  occupantCount: 1,
  personDays: 365,
  occupiedDays: 365,
  periodDays: 365,
};

const unitOg: UnitInfo = {
  id: "unit-og",
  name: "OG/DG",
  areaSqm: 120,
  occupantCount: 2,
  personDays: 730,
  occupiedDays: 365,
  periodDays: 365,
};

const meter = (
  id: string,
  role: MeterInfo["role"],
  unitId: string | null,
  label: string,
  validity: { validFrom?: string; validUntil?: string | null } = {},
): MeterInfo => ({
  id,
  type: "water_cold",
  role,
  unitId,
  label,
  measurementUnit: "m3",
  validFrom: validity.validFrom ?? "1900-01-01",
  validUntil: validity.validUntil ?? null,
});

const reading = (date: string, value: number): ReadingPoint => ({
  date,
  value,
  isCumulative: true,
  isEstimated: false,
});

const physicalBundle = (
  id: string,
  role: MeterInfo["role"],
  unitId: string | null,
  label: string,
  readings: ReadingPoint[],
  validity: { validFrom?: string; validUntil?: string | null } = {},
): WaterMeterBundle => ({
  meter: meter(id, role, unitId, label, validity),
  readings,
});

const virtualBundle = (
  id: string,
  unitId: string | null,
  label: string,
  config: DifferenceConfigInput,
  validity: { validFrom?: string; validUntil?: string | null } = {},
): WaterMeterBundle => ({
  meter: meter(id, "virtual_difference", unitId, label, validity),
  readings: [],
  differenceConfig: config,
});

describe("calculateWater", () => {
  it("Differenzzähler-Szenario: Haupt − OG − Gartenwasser_OG = EG", () => {
    // Haupt: 200 m3 Gesamt, OG-Wohnung: 100 m3, Gartenwasser OG: 30 m3.
    // EG (Differenz): 200 − 100 − 30 = 70 m3.
    const result = calculateWater({
      units: [unitEg, unitOg],
      waterMeters: [
        physicalBundle("main", "main", null, "Hauptzähler", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 200),
        ]),
        physicalBundle("og", "unit", "unit-og", "OG-Wohnung", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 100),
        ]),
        physicalBundle("garten", "common", "unit-og", "Gartenwasser OG", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 30),
        ]),
        virtualBundle("eg-diff", "unit-eg", "EG (Differenz)", {
          baseMeterId: "main",
          subtractedMeterIds: ["og", "garten"],
        }),
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    expect(result.totalConsumptionM3).toBe(200);

    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    const og = result.perUnit.find((u) => u.unitId === "unit-og");

    expect(eg?.consumptionM3).toBe(70);
    expect(eg?.isDifferential).toBe(true);
    expect(eg?.meterContributions).toEqual([
      { label: "EG (Differenz)", consumptionM3: 70 },
    ]);
    expect(og?.consumptionM3).toBe(130); // 100 + 30 Gartenwasser
    expect(og?.isDifferential).toBe(false);
    expect(og?.meterContributions).toEqual([
      { label: "OG-Wohnung", consumptionM3: 100 },
      { label: "Gartenwasser OG", consumptionM3: 30 },
    ]);
  });

  it("Differenzzähler + zusätzlicher Wohnungs-Zähler: beide Beiträge separat", () => {
    // EG hat einen Differenzzähler UND einen weiteren common-Zähler
    // (Waschmaschine EG). meterContributions muss beide ausweisen - den
    // Differenzzähler aber nur als ein Eintrag mit seinem End-Verbrauch
    // (ohne innere Formel, die andere Wohnungen offenlegen würde).
    const result = calculateWater({
      units: [unitEg, unitOg],
      waterMeters: [
        physicalBundle("main", "main", null, "Hauptzähler", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 200),
        ]),
        physicalBundle("og", "unit", "unit-og", "OG-Wohnung", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 100),
        ]),
        physicalBundle("wama-eg", "common", "unit-eg", "Waschmaschine EG", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 10),
        ]),
        virtualBundle("eg-diff", "unit-eg", "EG (Differenz)", {
          baseMeterId: "main",
          subtractedMeterIds: ["og", "wama-eg"],
        }),
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    expect(eg?.consumptionM3).toBe(100); // 10 + (200 − 100 − 10)
    expect(eg?.isDifferential).toBe(true);
    expect(eg?.meterContributions).toEqual([
      { label: "Waschmaschine EG", consumptionM3: 10 },
      { label: "EG (Differenz)", consumptionM3: 90 },
    ]);
  });

  it("Share-Prozent summiert sich auf 100", () => {
    const result = calculateWater({
      units: [unitEg, unitOg],
      waterMeters: [
        physicalBundle("main", "main", null, "Haupt", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 100),
        ]),
        physicalBundle("og", "unit", "unit-og", "OG", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 70),
        ]),
        virtualBundle("eg-diff", "unit-eg", "EG (Differenz)", {
          baseMeterId: "main",
          subtractedMeterIds: ["og"],
        }),
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    const sumPct = result.perUnit.reduce((acc, u) => acc + u.sharePct, 0);
    expect(sumPct).toBeCloseTo(100, 5);
  });

  it("wirft bei fehlendem Hauptzähler", () => {
    expect(() =>
      calculateWater({
        units: [unitEg, unitOg],
        waterMeters: [
          physicalBundle("og", "unit", "unit-og", "OG", [
            reading("2025-01-01", 0),
            reading("2025-12-31", 100),
          ]),
        ],
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      }),
    ).toThrow(/waterNoMainMeter/u);
  });

  it("Zählertausch beim Hauptzähler: zwei main-Records mit überlappungsfreier Gültigkeit", () => {
    // Alter Hauptzähler bis 2025-02-12 (Verbrauch 11 m3), neuer ab
    // 2025-02-13 (Verbrauch 137 m3). Gesamt = 148 m3.
    const result = calculateWater({
      units: [unitEg, unitOg],
      waterMeters: [
        physicalBundle(
          "main-alt",
          "main",
          null,
          "Hauptzähler alt",
          [reading("2025-01-01", 691), reading("2025-02-12", 702)],
          { validFrom: "2025-01-01", validUntil: "2025-02-12" },
        ),
        physicalBundle(
          "main-neu",
          "main",
          null,
          "Hauptzähler neu",
          [reading("2025-02-13", 0), reading("2025-12-31", 137)],
          { validFrom: "2025-02-13" },
        ),
        physicalBundle("og", "unit", "unit-og", "OG", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 60),
        ]),
        virtualBundle(
          "eg-diff",
          "unit-eg",
          "EG-Differenz",
          { baseMeterId: "main-neu", subtractedMeterIds: ["og"] },
          { validFrom: "2025-02-13" },
        ),
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    expect(result.totalConsumptionM3).toBeCloseTo(148, 5);
    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    // Differenzzähler ab 13.02. -> Hauptzähler-neu (137) − OG-Anteil
    // ab 13.02. (interpoliert: 60 − 7,088 ~= 52,91) ~= 84,09 m3.
    expect(eg?.consumptionM3).toBeCloseTo(84.09, 1);
  });

  it("Zähler außerhalb der Periode taucht weder in Verbrauch noch in Fußnote auf", () => {
    // Waschmaschine-Zähler wird erst nach Abrechnungsperiode gültig
    // (Tippfehler-Szenario): kein Beitrag zu unitConsumption, kein
    // Eintrag in meterContributions.
    const result = calculateWater({
      units: [unitEg, unitOg],
      waterMeters: [
        physicalBundle("main", "main", null, "Haupt", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 200),
        ]),
        physicalBundle("eg", "unit", "unit-eg", "EG", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 70),
        ]),
        physicalBundle(
          "eg-waschmaschine",
          "unit",
          "unit-eg",
          "Waschmaschine EG",
          [reading("2026-05-05", 0), reading("2026-12-31", 5)],
          { validFrom: "2026-05-05" },
        ),
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    expect(eg?.consumptionM3).toBe(70);
    expect(eg?.meterContributions.map((c) => c.label)).toEqual(["EG"]);
  });

  it("warnt bei Allgemeinzähler ohne Wohnungs-Zuordnung", () => {
    // Gartenwasser ist als common-Zähler erfasst, aber keiner Wohnung
    // zugeordnet (unitId null). Sein Verbrauch verschwindet aus der
    // Pro-Wohnung-Aggregation - darauf muss gewarnt werden.
    const result = calculateWater({
      units: [unitEg, unitOg],
      waterMeters: [
        physicalBundle("main", "main", null, "Haupt", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 200),
        ]),
        physicalBundle("og", "unit", "unit-og", "OG", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 100),
        ]),
        physicalBundle("garten", "common", null, "Gartenwasser", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 15),
        ]),
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    expect(result.warnings).toContainEqual({
      code: "commonConsumptionUnallocated",
      params: { label: "Gartenwasser" },
    });
  });

  it("Wohnung ohne Zähler bekommt 0 (Differenzzähler fehlt)", () => {
    const result = calculateWater({
      units: [unitEg, unitOg],
      waterMeters: [
        physicalBundle("main", "main", null, "Haupt", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 200),
        ]),
        physicalBundle("og", "unit", "unit-og", "OG", [
          reading("2025-01-01", 0),
          reading("2025-12-31", 100),
        ]),
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    expect(eg?.consumptionM3).toBe(0);
    expect(eg?.isDifferential).toBe(false);
    // Ohne Differenzzähler bleiben 100 m3 (200 Haupt − 100 OG − 0 EG)
    // unerklärt
    expect(result.warnings).toContainEqual({
      code: "waterUnitSumMismatch",
      params: { total: "200", unitSum: "100" },
    });
  });
});
