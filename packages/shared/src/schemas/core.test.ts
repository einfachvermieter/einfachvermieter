import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  checkStatementPeriod,
  costEntryItemSchema,
  isLikelyNonAllocatableCostTypeName,
} from "./core.js";

describe("isLikelyNonAllocatableCostTypeName (§ 1 Abs. 2 BetrKV)", () => {
  it("erkennt Verwaltungs- und Instandhaltungskosten", () => {
    for (const name of [
      "Hausverwaltung",
      "Verwaltung",
      "Instandhaltung Dach",
      "Instandsetzung Fassade",
      "Reparatur Aufzug",
      "Rücklage",
      "Finanzierungskosten",
      "Zinsen Darlehen",
      "Maklerprovision",
      "Leerstandskosten",
    ]) {
      expect(isLikelyNonAllocatableCostTypeName(name)).toBe(true);
    }
  });

  it("lässt umlagefähige Kostenarten unbeanstandet", () => {
    for (const name of [
      "Gartenpflege",
      "Müllabfuhr",
      "Hausmeister",
      "Grundsteuer",
      "Wasser/Abwasser",
      "Aufzug",
    ]) {
      expect(isLikelyNonAllocatableCostTypeName(name)).toBe(false);
    }
  });

  it("prüft ohne Rücksicht auf Groß- und Kleinschreibung", () => {
    expect(isLikelyNonAllocatableCostTypeName("HAUSVERWALTUNG")).toBe(true);
    expect(isLikelyNonAllocatableCostTypeName("rücklage 2025")).toBe(true);
  });
});

describe("costEntryItemSchema - Berechnungsgrundlagen CO2", () => {
  const item = {
    costTypeId: "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b",
    amountCents: 100_000,
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  };
  const accepts = (extra: Record<string, number | null>) =>
    costEntryItemSchema.safeParse({ ...item, ...extra }).success;

  it("nimmt Energiegehalt und Emissionsfaktor an, beide optional", () => {
    expect(accepts({})).toBe(true);
    expect(
      accepts({ co2EnergyKwh: 44_000.5, co2EmissionFactorKgPerKwh: 0.200_88 }),
    ).toBe(true);
    expect(
      accepts({ co2EnergyKwh: null, co2EmissionFactorKgPerKwh: null }),
    ).toBe(true);
  });

  it("lehnt einen Faktor über 1 (Eingabe in Gramm je kWh) und negative Werte ab", () => {
    expect(accepts({ co2EmissionFactorKgPerKwh: 200.88 })).toBe(false);
    expect(accepts({ co2EmissionFactorKgPerKwh: -0.2 })).toBe(false);
    expect(accepts({ co2EnergyKwh: -1 })).toBe(false);
  });
});

describe("checkStatementPeriod", () => {
  const periodSchema = z
    .object({ start: z.string(), end: z.string() })
    .superRefine((p, ctx) => checkStatementPeriod(p.start, p.end, "end", ctx));
  const isValid = (start: string, end: string) =>
    periodSchema.safeParse({ start, end }).success;

  it("lässt bis zu zwölf Monate einschließlich Enddatum zu", () => {
    expect(isValid("2025-01-01", "2025-12-31")).toBe(true);
    expect(isValid("2025-04-01", "2026-03-31")).toBe(true);
    expect(isValid("2025-04-15", "2026-04-14")).toBe(true);
    expect(isValid("2024-02-29", "2025-02-28")).toBe(true);
  });

  it("lehnt längere Zeiträume ab", () => {
    expect(isValid("2025-01-01", "2026-01-01")).toBe(false);
    expect(isValid("2025-01-01", "2026-01-31")).toBe(false);
    expect(isValid("2024-02-29", "2025-03-01")).toBe(false);
  });

  it("lehnt Ende vor oder gleich Beginn ab", () => {
    expect(isValid("2025-01-01", "2025-01-01")).toBe(false);
    expect(isValid("2025-02-01", "2025-01-01")).toBe(false);
  });
});
