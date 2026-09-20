import { describe, expect, it } from "vitest";
import type { CalcWarning, ReadingPoint } from "../types/index.js";
import { sumDegreeDays } from "./heating.js";
import {
  consumptionBetween,
  interpolateReading,
  isDerivedConsumption,
} from "./meters.js";

const degreeDayWeight = (fromDate: string, toDate: string): number =>
  sumDegreeDays({ start: fromDate, end: toDate });

const reading = (date: string, value: number): ReadingPoint => ({
  date,
  value,
  isCumulative: true,
  isEstimated: false,
});

const estimated = (date: string, value: number): ReadingPoint => ({
  ...reading(date, value),
  isEstimated: true,
});

describe("interpolateReading", () => {
  it("exakter Treffer", () => {
    const readings = [reading("2025-01-01", 1000), reading("2025-12-31", 1100)];
    expect(interpolateReading(readings, "2025-01-01")).toBe(1000);
    expect(interpolateReading(readings, "2025-12-31")).toBe(1100);
  });

  it("lineare Interpolation in der Mitte", () => {
    const readings = [reading("2025-01-01", 1000), reading("2025-12-31", 1365)];
    // ca. Tag 180 von 364 -> ca. 1182
    const mid = interpolateReading(readings, "2025-06-30");
    expect(mid).toBeGreaterThan(1180);
    expect(mid).toBeLessThan(1185);
  });

  it("wirft bei Extrapolation vor erstem Stand", () => {
    const readings = [reading("2025-06-01", 1000), reading("2025-12-31", 1100)];
    expect(() => interpolateReading(readings, "2025-01-01")).toThrow(
      /before first reading/u,
    );
  });

  it("wirft bei Extrapolation nach letztem Stand", () => {
    const readings = [reading("2025-01-01", 1000), reading("2025-06-30", 1100)];
    expect(() => interpolateReading(readings, "2025-12-31")).toThrow(
      /after last reading/u,
    );
  });

  it("wirft bei leerer Readings-Liste", () => {
    expect(() => interpolateReading([], "2025-01-01")).toThrow(
      /readingNoneAvailable/u,
    );
  });

  it("gradtagsgewichtete Interpolation setzt Sommer-Stichtag höher an als linear", () => {
    // § 9b HeizkostenV: ohne Zwischenablesung wird der Stand am Stichtag
    // geschätzt. Bis Ende Juni ist der Großteil des Jahres-Heizbedarfs
    // (Winter) bereits verbraucht -> der gradtagsgewichtete Schätzwert liegt
    // über dem linearen.
    const readings = [reading("2025-01-01", 1000), reading("2025-12-31", 1365)];
    const linear = interpolateReading(readings, "2025-06-30");
    const degreeDay = interpolateReading(readings, "2025-06-30", {
      intervalWeight: degreeDayWeight,
    });
    // Summe Gradtage 01.01.-30.06. = 583 ‰ von 1.000 ‰ -> 1000 + 365 x 0,583.
    expect(degreeDay).toBeGreaterThan(linear);
    expect(degreeDay).toBeGreaterThan(1208);
    expect(degreeDay).toBeLessThan(1216);
  });
});

describe("consumptionBetween", () => {
  it("berechnet Verbrauch über vollständige Periode mit bekannten Ständen", () => {
    const readings = [reading("2025-01-01", 1000), reading("2025-12-31", 1100)];
    expect(consumptionBetween(readings, "2025-01-01", "2025-12-31")).toBe(100);
  });

  it("interpoliert Start und Ende", () => {
    const readings = [
      reading("2024-07-01", 500),
      reading("2025-07-01", 1000), // 500 m3 in einem Jahr
    ];
    // Teilperiode 01.01.2025 - 30.06.2025 = ca. halbes Jahr = ca. 250
    const consumption = consumptionBetween(
      readings,
      "2025-01-01",
      "2025-06-30",
    );
    expect(consumption).toBeGreaterThan(240);
    expect(consumption).toBeLessThan(260);
  });

  it("gradtagsgewichtet ordnet dem Winter-Mieter mehr Verbrauch zu als linear", () => {
    const readings = [reading("2025-01-01", 0), reading("2025-12-31", 1000)];
    // Mieter A: 01.01.-30.06. (winterlastige Heizphase).
    const linear = consumptionBetween(readings, "2025-01-01", "2025-06-30");
    const degreeDay = consumptionBetween(readings, "2025-01-01", "2025-06-30", {
      intervalWeight: degreeDayWeight,
    });
    expect(degreeDay).toBeGreaterThan(linear);
    expect(degreeDay).toBeGreaterThan(550); // ~= 583 ‰
    expect(degreeDay).toBeLessThan(600);
  });
});

describe("readingEstimated-Kennzeichnung", () => {
  it("exakter Treffer auf geschätztem Stand meldet Warnung", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      estimated("2025-01-01", 1000),
      reading("2025-12-31", 1100),
    ];
    interpolateReading(readings, "2025-01-01", { warnings, label: "Küche" });
    expect(warnings).toEqual([
      {
        code: "readingEstimated",
        params: { date: "2025-01-01", label: "Küche" },
      },
    ]);
  });

  it("Interpolation über geschätzten Nachbar-Stand meldet Warnung", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      reading("2025-01-01", 1000),
      estimated("2025-12-31", 1100),
    ];
    interpolateReading(readings, "2025-06-30", { warnings });
    expect(warnings).toEqual([
      { code: "readingEstimated", params: { date: "2025-12-31" } },
    ]);
  });

  it("geclampter Randwert auf geschätztem Stand meldet beide Warnungen", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      estimated("2025-02-01", 1000),
      reading("2025-12-31", 1100),
    ];
    interpolateReading(readings, "2025-01-01", { warnings });
    expect(warnings).toContainEqual({
      code: "readingEstimated",
      params: { date: "2025-02-01" },
    });
    expect(warnings).toContainEqual({
      code: "readingMissingBefore",
      params: { date: "2025-02-01" },
    });
  });

  it("dedupliziert: Periode-Start und -Ende über denselben geschätzten Stand", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      reading("2024-07-01", 500),
      estimated("2025-03-01", 800),
      reading("2025-07-01", 1000),
    ];
    // Start- und End-Interpolation berühren beide den Schätzwert vom 01.03.
    consumptionBetween(readings, "2025-01-01", "2025-06-30", { warnings });
    const estimatedWarnings = warnings.filter(
      (warning) => warning.code === "readingEstimated",
    );
    expect(estimatedWarnings).toEqual([
      { code: "readingEstimated", params: { date: "2025-03-01" } },
    ]);
  });

  it("Rand-Extrapolation an beiden Enden meldet die Warnung nur einmal", () => {
    const warnings: CalcWarning[] = [];
    const readings = [reading("2025-01-01", 1000), reading("2025-06-30", 1100)];
    // Start und Ende liegen beide nach der letzten Ablesung.
    consumptionBetween(readings, "2025-07-01", "2025-12-31", {
      warnings,
      label: "Wärmemengenzähler EG",
    });
    const missingAfter = warnings.filter(
      (warning) => warning.code === "readingMissingAfter",
    );
    expect(missingAfter).toEqual([
      {
        code: "readingMissingAfter",
        params: { date: "2025-06-30", label: "Wärmemengenzähler EG" },
      },
    ]);
  });

  it("ohne geschätzte Stände keine Warnung", () => {
    const warnings: CalcWarning[] = [];
    const readings = [reading("2025-01-01", 1000), reading("2025-12-31", 1100)];
    consumptionBetween(readings, "2025-01-01", "2025-12-31", { warnings });
    expect(warnings).toEqual([]);
  });

  it("ohne warnings-Option wirft die Schätzungs-Erkennung nicht", () => {
    const readings = [
      estimated("2025-01-01", 1000),
      estimated("2025-12-31", 1100),
    ];
    expect(consumptionBetween(readings, "2025-01-01", "2025-12-31")).toBe(100);
  });
});

describe("readingNonMonotonic-Warnung", () => {
  it("meldet einen rückläufigen Stand (Zählerrücklauf)", () => {
    const warnings: CalcWarning[] = [];
    // 0 (01.01.) -> 95 (30.06.) -> 90 (31.12.) - der zweite
    // Sprung ist rückläufig und würde unbemerkt einen überhöhten Verbrauch
    // in die Vorperiode verschieben.
    const readings = [
      reading("2025-01-01", 0),
      reading("2025-06-30", 95),
      reading("2025-12-31", 90),
    ];
    consumptionBetween(readings, "2025-01-01", "2025-09-30", {
      warnings,
      label: "Küche",
    });
    expect(warnings).toContainEqual({
      code: "readingNonMonotonic",
      params: {
        fromDate: "2025-06-30",
        toDate: "2025-12-31",
        label: "Küche",
      },
      detail: {
        fromValue: "95",
        toValue: "90",
      },
    });
  });

  it("dedupliziert bei wiederholten Aufrufen mit denselben Ständen", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      reading("2025-01-01", 0),
      reading("2025-06-30", 95),
      reading("2025-12-31", 90),
    ];
    consumptionBetween(readings, "2025-01-01", "2025-06-30", { warnings });
    consumptionBetween(readings, "2025-07-01", "2025-12-31", { warnings });
    const nonMonotonic = warnings.filter(
      (warning) => warning.code === "readingNonMonotonic",
    );
    expect(nonMonotonic).toHaveLength(1);
  });

  it("ignoriert nicht-kumulative Stände", () => {
    const warnings: CalcWarning[] = [];
    const readings: ReadingPoint[] = [
      { date: "2025-01-01", value: 0, isCumulative: false, isEstimated: false },
      {
        date: "2025-06-30",
        value: 95,
        isCumulative: false,
        isEstimated: false,
      },
      {
        date: "2025-12-31",
        value: 90,
        isCumulative: false,
        isEstimated: false,
      },
    ];
    consumptionBetween(readings, "2025-01-01", "2025-12-31", { warnings });
    expect(
      warnings.filter((warning) => warning.code === "readingNonMonotonic"),
    ).toEqual([]);
  });

  it("meldet einen Rücklauf nach dem Periodenende nicht", () => {
    const warnings: CalcWarning[] = [];
    // Heizkostenverteiler, der zum Jahreswechsel wieder bei 0 beginnt. Für
    // die Abrechnung 2025 ist der Stand vom 01.01.2026 ohne Wirkung, der
    // Endstand steht als echte Ablesung fest.
    const readings = [
      reading("2025-01-01", 0),
      reading("2025-12-31", 667),
      reading("2026-01-01", 0),
    ];
    consumptionBetween(readings, "2025-01-01", "2025-12-31", { warnings });
    expect(
      warnings.filter((warning) => warning.code === "readingNonMonotonic"),
    ).toEqual([]);
  });

  it("meldet denselben Rücklauf in der Folgeperiode, weil er dort den Anfangsstand setzt", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      reading("2025-12-31", 667),
      reading("2026-01-01", 0),
      reading("2026-12-31", 500),
    ];
    consumptionBetween(readings, "2026-01-01", "2026-12-31", { warnings });
    expect(
      warnings.filter((warning) => warning.code === "readingNonMonotonic"),
    ).toHaveLength(1);
  });

  it("meldet einen Rücklauf über die Periodengrenze, weil der Endstand interpoliert wird", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      reading("2025-01-01", 0),
      reading("2025-12-15", 667),
      reading("2026-01-15", 0),
    ];
    consumptionBetween(readings, "2025-01-01", "2025-12-31", { warnings });
    expect(
      warnings.filter((warning) => warning.code === "readingNonMonotonic"),
    ).toHaveLength(1);
  });

  it("meldet den Neubeginn am Stichtag nicht", () => {
    const warnings: CalcWarning[] = [];
    // Heizkostenverteiler mit Stichtag 31.12.: Der Januarwert ist der Stand
    // seit dem Neubeginn, nicht der Rest eines durchlaufenden Zählwerks.
    const readings = [
      reading("2025-12-31", 667),
      reading("2026-01-15", 12),
      reading("2026-12-31", 500),
    ];
    consumptionBetween(readings, "2026-01-01", "2026-12-31", {
      warnings,
      resetDay: "12-31",
    });
    expect(
      warnings.filter((warning) => warning.code === "readingNonMonotonic"),
    ).toEqual([]);
  });

  it("meldet einen Rücklauf, der nicht über den Stichtag läuft, auch mit Stichtag", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      reading("2026-01-15", 120),
      reading("2026-03-20", 80),
      reading("2026-12-31", 500),
    ];
    consumptionBetween(readings, "2026-01-01", "2026-12-31", {
      warnings,
      resetDay: "12-31",
    });
    expect(
      warnings.filter((warning) => warning.code === "readingNonMonotonic"),
    ).toHaveLength(1);
  });

  it("meldet einen Rücklauf auf den Stichtag, weil der Stand dort der Jahreswert ist", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      reading("2026-01-15", 12),
      reading("2026-06-30", 400),
      reading("2026-12-31", 380),
    ];
    consumptionBetween(readings, "2026-01-01", "2026-12-31", {
      warnings,
      resetDay: "12-31",
    });
    expect(
      warnings.filter((warning) => warning.code === "readingNonMonotonic"),
    ).toHaveLength(1);
  });

  it("meldet einen Rücklauf vor der Periode nicht", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      reading("2024-06-30", 500),
      reading("2024-12-31", 100),
      reading("2025-12-31", 300),
    ];
    consumptionBetween(readings, "2025-01-01", "2025-12-31", { warnings });
    expect(
      warnings.filter((warning) => warning.code === "readingNonMonotonic"),
    ).toEqual([]);
  });

  it("steigende Stände lösen keine Warnung aus", () => {
    const warnings: CalcWarning[] = [];
    const readings = [
      reading("2025-01-01", 0),
      reading("2025-06-30", 50),
      reading("2025-12-31", 100),
    ];
    consumptionBetween(readings, "2025-01-01", "2025-12-31", { warnings });
    expect(
      warnings.filter((warning) => warning.code === "readingNonMonotonic"),
    ).toEqual([]);
  });
});

describe("Verbrauch über einen Neubeginn der Zählung", () => {
  it("addiert die Abschnitte vor und nach dem Stichtag", () => {
    // Mietzeitraum 01.03.2025 bis 28.02.2026, Stichtag 31.12.
    // Abschnitt 1: 667 - 200 = 467, Abschnitt 2: 90 - 0 = 90.
    const readings = [
      reading("2025-03-01", 200),
      reading("2025-12-31", 667),
      reading("2026-01-01", 0),
      reading("2026-02-28", 90),
    ];

    expect(
      consumptionBetween(readings, "2025-03-01", "2026-02-28", {
        warnings: [],
        resetDay: "12-31",
      }),
    ).toBeCloseTo(557);
  });

  it("verschluckt ohne Stichtag alles vor dem Neubeginn", () => {
    const readings = [
      reading("2025-03-01", 200),
      reading("2025-12-31", 667),
      reading("2026-01-01", 0),
      reading("2026-02-28", 90),
    ];

    // Ohne Stichtag bleibt es bei Endstand minus Anfangsstand, der negative
    // Wert wird auf 0 begrenzt.
    expect(
      consumptionBetween(readings, "2025-03-01", "2026-02-28", {
        warnings: [],
      }),
    ).toBe(0);
  });

  it("nimmt den Neubeginn auch ohne Ablesung am ersten Tag danach an", () => {
    const readings = [
      reading("2025-03-01", 200),
      reading("2025-12-31", 667),
      reading("2026-02-28", 90),
    ];

    expect(
      consumptionBetween(readings, "2025-03-01", "2026-02-28", {
        warnings: [],
        resetDay: "12-31",
      }),
    ).toBeCloseTo(557);
  });

  it("lässt eine Periode, die am Stichtag endet, ungeteilt", () => {
    const readings = [
      reading("2025-01-01", 0),
      reading("2025-12-31", 667),
      reading("2026-01-01", 0),
    ];

    expect(
      consumptionBetween(readings, "2025-01-01", "2025-12-31", {
        warnings: [],
        resetDay: "12-31",
      }),
    ).toBeCloseTo(667);
  });

  it("zählt über zwei Stichtage hinweg alle Abschnitte", () => {
    const readings = [
      reading("2025-03-01", 200),
      reading("2025-12-31", 600),
      reading("2026-12-31", 500),
      reading("2027-02-28", 80),
    ];

    // 400 + 500 + 80
    expect(
      consumptionBetween(readings, "2025-03-01", "2027-02-28", {
        warnings: [],
        resetDay: "12-31",
      }),
    ).toBeCloseTo(980);
  });
});

describe("negativer Verbrauch", () => {
  it("begrenzt einen rückläufigen Zähler auf 0 und warnt", () => {
    const warnings: CalcWarning[] = [];
    const readings = [reading("2025-01-01", 500), reading("2025-12-31", 10)];

    const consumption = consumptionBetween(
      readings,
      "2025-01-01",
      "2025-12-31",
      { warnings, label: "Wohnung A" },
    );

    expect(consumption).toBe(0);
    expect(warnings).toContainEqual({
      code: "consumptionNegative",
      params: { label: "Wohnung A" },
    });
  });

  it("meldet denselben Zähler nur einmal", () => {
    const warnings: CalcWarning[] = [];
    const readings = [reading("2025-01-01", 500), reading("2025-12-31", 10)];

    consumptionBetween(readings, "2025-01-01", "2025-06-30", {
      warnings,
      label: "Wohnung A",
    });
    consumptionBetween(readings, "2025-07-01", "2025-12-31", {
      warnings,
      label: "Wohnung A",
    });

    expect(
      warnings.filter((warning) => warning.code === "consumptionNegative"),
    ).toHaveLength(1);
  });
});

describe("isDerivedConsumption", () => {
  const readings = [
    reading("2025-01-01", 1000),
    reading("2025-06-30", 1050),
    reading("2025-12-31", 1100),
  ];

  it("false, wenn beide Stichtage echte Ablesungen haben", () => {
    expect(isDerivedConsumption(readings, "2025-01-01", "2025-12-31")).toBe(
      false,
    );
    expect(isDerivedConsumption(readings, "2025-01-01", "2025-06-30")).toBe(
      false,
    );
  });

  it("true, wenn zu einem Stichtag keine Ablesung vorliegt", () => {
    expect(isDerivedConsumption(readings, "2025-01-01", "2025-07-31")).toBe(
      true,
    );
    expect(isDerivedConsumption(readings, "2025-03-15", "2025-12-31")).toBe(
      true,
    );
  });

  it("true, wenn die Ablesung am Stichtag geschätzt ist", () => {
    const withEstimate = [
      reading("2025-01-01", 1000),
      estimated("2025-12-31", 1100),
    ];
    expect(isDerivedConsumption(withEstimate, "2025-01-01", "2025-12-31")).toBe(
      true,
    );
  });
});
