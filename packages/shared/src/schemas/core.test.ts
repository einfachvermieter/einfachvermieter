import { describe, expect, it } from "vitest";
import { isLikelyNonAllocatableCostTypeName } from "./core.js";

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
