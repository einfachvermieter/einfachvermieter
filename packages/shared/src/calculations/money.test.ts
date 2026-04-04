import { describe, expect, it } from "vitest";
import { bpsToFactor, distributeCents } from "./money.js";

describe("distributeCents", () => {
  it("summe der teile = total (keine Rundung)", () => {
    const result = distributeCents(10_000, [1, 1, 1, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(result).toEqual([2500, 2500, 2500, 2500]);
  });

  it("behandelt Rundungsdifferenz durch Zuschlag auf groesstes Gewicht", () => {
    // 100 Cent / 3 = 33.33 pro Teil -> 33, 33, 33 = 99, Differenz 1
    const result = distributeCents(100, [1, 1, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("verteilt nach Gewicht proportional", () => {
    // qm: 70 / 130 gesamt, 1000 Cent Kosten
    const [first, second] = distributeCents(1000, [70, 60]);
    expect(first).toBe(538); // 1000 * 70/130 = 538.46 -> 538
    expect(second).toBe(462); // 1000 - 538
    expect((first ?? 0) + (second ?? 0)).toBe(1000);
  });

  it("Null-Gewichte werden zu Null verteilt", () => {
    const result = distributeCents(1000, [0, 1]);
    expect(result).toEqual([0, 1000]);
  });

  it("alle Gewichte Null -> alle Teile Null", () => {
    const result = distributeCents(1000, [0, 0, 0]);
    expect(result).toEqual([0, 0, 0]);
  });

  it("1-Cent-Problem: Gesamtsumme stimmt immer", () => {
    // Absichtlich problematischer Fall, soll trotzdem exakt aufgehen
    const result = distributeCents(123_456, [33, 33, 34]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(123_456);
  });
});

describe("bps-Konvertierung", () => {
  it("7000 bps = 0.70", () => {
    expect(bpsToFactor(7000)).toBe(0.7);
  });
});
