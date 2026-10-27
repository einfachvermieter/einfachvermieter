import type { HeatingSettings } from "@einfachvermieter/shared";
import { describe, expect, it } from "vitest";
import type { CostType } from "./costs";
import {
  existingCostTypeNames,
  hasUnitWaterMeters,
  heatingNoticeMode,
  usesCo2Split,
} from "./costTypeTemplates";
import type { Meter } from "./meters";

const meter = (overrides: Partial<Meter>) =>
  ({
    unitId: "unit-1",
    type: "water_cold",
    isActive: true,
    ...overrides,
  }) as Meter;

const config = (overrides: Partial<HeatingSettings>) =>
  ({
    mode: "internal",
    validFrom: "2025-01-01",
    validTo: null,
    co2CostShareEnabled: true,
    fuelType: "gas",
    ...overrides,
  }) as HeatingSettings;

describe("hasUnitWaterMeters", () => {
  it("zählt aktive Wasserzähler einer Wohnung, auch Differenzzähler", () => {
    expect(hasUnitWaterMeters([meter({})])).toBe(true);
    expect(hasUnitWaterMeters([meter({ type: "water_hot" })])).toBe(true);
    expect(hasUnitWaterMeters([meter({ role: "virtual_difference" })])).toBe(
      true,
    );
  });

  it("zählt Hauptzähler, inaktive und andere Zähler nicht", () => {
    expect(hasUnitWaterMeters([])).toBe(false);
    expect(hasUnitWaterMeters([meter({ unitId: null })])).toBe(false);
    expect(hasUnitWaterMeters([meter({ isActive: false })])).toBe(false);
    expect(hasUnitWaterMeters([meter({ type: "heat_meter" })])).toBe(false);
  });
});

describe("usesCo2Split", () => {
  it("ist gesetzt bei Aufteilung mit Gas", () => {
    expect(usesCo2Split([config({})])).toBe(true);
  });

  it("ist nicht gesetzt ohne Konfiguration, ohne Aufteilung und bei Pellets", () => {
    expect(usesCo2Split([])).toBe(false);
    expect(usesCo2Split([config({ co2CostShareEnabled: false })])).toBe(false);
    expect(usesCo2Split([config({ fuelType: "pellets" })])).toBe(false);
  });

  it("zählt externe Abrechnung und keine Heizkostenabrechnung nicht", () => {
    expect(usesCo2Split([config({ mode: "external" })])).toBe(false);
    expect(usesCo2Split([config({ mode: "none" })])).toBe(false);
  });
});

describe("existingCostTypeNames", () => {
  it("vergleicht ohne Rand-Leerzeichen und Groß- und Kleinschreibung je Gebäude", () => {
    const names = existingCostTypeNames(
      [
        { buildingId: "a", name: " grundSTEUER " },
        { buildingId: "b", name: "Aufzug" },
      ] as CostType[],
      "a",
    );
    expect(names.has("grundsteuer")).toBe(true);
    expect(names.has("aufzug")).toBe(false);
  });
});

describe("heatingNoticeMode", () => {
  const today = "2026-10-27";

  it("nimmt die heute gültige Version, nicht die jüngste", () => {
    const versions = [
      config({ mode: "internal", validFrom: "2027-01-01" }),
      config({ mode: "none", validFrom: "2026-01-01", validTo: "2026-12-31" }),
    ];
    expect(heatingNoticeMode(versions, today)).toBe("none");
  });

  it("nimmt in einer Lücke die zuletzt gültige Version", () => {
    const versions = [
      config({ mode: "internal", validFrom: "2027-01-01" }),
      config({ mode: "external", validTo: "2025-12-31" }),
    ];
    expect(heatingNoticeMode(versions, today)).toBe("external");
  });

  it("nimmt die künftige Version, wenn keine begonnen hat", () => {
    expect(
      heatingNoticeMode(
        [config({ mode: "none", validFrom: "2027-01-01" })],
        today,
      ),
    ).toBe("none");
  });

  it("zeigt keinen Hinweis bei interner Abrechnung oder ohne Konfiguration", () => {
    expect(heatingNoticeMode([config({})], today)).toBeNull();
    expect(heatingNoticeMode([], today)).toBeNull();
  });
});
