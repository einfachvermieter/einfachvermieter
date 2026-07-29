import { describe, expect, it } from "vitest";
import {
  daysBetween,
  daysInYear,
  intersect,
  prorationFactor,
} from "./period.js";

describe("daysInYear", () => {
  it("liefert 366 im Schaltjahr und sonst 365", () => {
    expect(daysInYear("2024-07-15")).toBe(366);
    expect(daysInYear("2025-07-15")).toBe(365);
    // 2100 ist kein Schaltjahr (durch 100, nicht durch 400 teilbar).
    expect(daysInYear("2100-03-01")).toBe(365);
  });
});

describe("daysBetween", () => {
  it("berechnet ganzes Jahr korrekt (inklusiv)", () => {
    expect(daysBetween("2025-01-01", "2025-12-31")).toBe(365);
  });

  it("berechnet Schaltjahr korrekt", () => {
    expect(daysBetween("2024-01-01", "2024-12-31")).toBe(366);
  });

  it("ein einzelner Tag = 1", () => {
    expect(daysBetween("2025-06-15", "2025-06-15")).toBe(1);
  });

  it("Monatsgrenze korrekt", () => {
    expect(daysBetween("2025-01-01", "2025-01-31")).toBe(31);
  });
});

describe("intersect", () => {
  it("findet Overlap bei überlappenden Perioden", () => {
    const result = intersect(
      { start: "2024-08-01", end: "2025-07-31" },
      { start: "2025-01-01", end: "2025-12-31" },
    );
    expect(result).toEqual({ start: "2025-01-01", end: "2025-07-31" });
  });

  it("gibt null zurück bei überlappungsfreien Perioden", () => {
    const result = intersect(
      { start: "2024-01-01", end: "2024-06-30" },
      { start: "2024-07-01", end: "2024-12-31" },
    );
    expect(result).toBeNull();
  });

  it("funktioniert bei vollständiger Enthaltenheit", () => {
    const result = intersect(
      { start: "2025-01-01", end: "2025-12-31" },
      { start: "2025-03-01", end: "2025-08-31" },
    );
    expect(result).toEqual({ start: "2025-03-01", end: "2025-08-31" });
  });
});

describe("prorationFactor", () => {
  it("volle Überlappung -> 1,0", () => {
    const factor = prorationFactor(
      { start: "2025-01-01", end: "2025-12-31" },
      { start: "2025-01-01", end: "2025-12-31" },
    );
    expect(factor).toBe(1);
  });

  it("keine Überlappung -> 0", () => {
    const factor = prorationFactor(
      { start: "2023-01-01", end: "2023-12-31" },
      { start: "2025-01-01", end: "2025-12-31" },
    );
    expect(factor).toBe(0);
  });

  it("Gas-Rechnung über Jahresgrenze", () => {
    // Rechnung 01.08.2024 - 31.07.2025, Abrechnung 01.01.2025 - 31.12.2025
    // Overlap 01.01.2025 - 31.07.2025 = 212 Tage
    // Rechnung gesamt: 365 Tage
    const factor = prorationFactor(
      { start: "2024-08-01", end: "2025-07-31" },
      { start: "2025-01-01", end: "2025-12-31" },
    );
    expect(factor).toBeCloseTo(212 / 365, 6);
  });
});
