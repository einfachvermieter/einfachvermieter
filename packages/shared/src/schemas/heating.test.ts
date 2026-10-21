import { describe, expect, it } from "vitest";
import {
  emptyHeatingFormValues,
  heatingFormSchema,
  heatingFormToDto,
  heatingSettingsWriteSchema,
} from "./heating.js";
import {
  heatingPeriodValueRelevance,
  heatingPeriodValuesFormToDto,
  heatingPeriodValuesWriteSchema,
} from "./heating-period-values.js";

const internalBase = {
  mode: "internal" as const,
  validFrom: "2025-01-01",
  validTo: null,
  baseMethod: "heated_area" as const,
  consumptionMethod: "heat_meter" as const,
  prorationMethod: "linear" as const,
  heatingType: "central_without_hot_water" as const,
  fuelType: "gas" as const,
  hotWaterMeterId: null,
  hotWaterSupplyTemperatureCelsius: 60,
  gasBillingByCalorificValue: false,
  heatPumpMonovalent: false,
  mandatorySeventyPercent: false,
  co2CostShareEnabled: true,
};

const withShares = (
  consumptionSharePercent: number,
  baseSharePercent: number,
) =>
  heatingSettingsWriteSchema.safeParse({
    ...internalBase,
    consumptionSharePercent,
    baseSharePercent,
  });

describe("heatingSettingsWriteSchema - Verbrauchsanteil-Bandbreite (§ 7 HeizkostenV)", () => {
  it("akzeptiert 70/30 (obere Grenze)", () => {
    expect(withShares(70, 30).success).toBe(true);
  });

  it("akzeptiert 50/50 (untere Grenze)", () => {
    expect(withShares(50, 50).success).toBe(true);
  });

  it("lehnt Verbrauchsanteil über 70 % ab", () => {
    expect(withShares(80, 20).success).toBe(false);
  });

  it("lehnt Verbrauchsanteil unter 50 % ab", () => {
    expect(withShares(40, 60).success).toBe(false);
  });

  it("lehnt weiterhin ab, wenn die Summe != 100 ist", () => {
    expect(withShares(60, 30).success).toBe(false);
  });
});

describe("heatingSettingsWriteSchema - 70-%-Pflichtfall (§ 7 Abs. 1 Satz 2 HeizkostenV)", () => {
  const withMandatoryFlag = (consumptionSharePercent: number) =>
    heatingSettingsWriteSchema.safeParse({
      ...internalBase,
      mandatorySeventyPercent: true,
      consumptionSharePercent,
      baseSharePercent: 100 - consumptionSharePercent,
    });

  it("lehnt 60 % ab, wenn 70 % zwingend sind", () => {
    expect(withMandatoryFlag(60).success).toBe(false);
  });

  it("akzeptiert 70 %, wenn 70 % zwingend sind", () => {
    expect(withMandatoryFlag(70).success).toBe(true);
  });

  it("lässt 60 % ohne den Pflichtfall weiter zu", () => {
    expect(withShares(60, 40).success).toBe(true);
  });
});

describe("Werte je Abrechnungszeitraum", () => {
  const period = { periodStart: "2025-01-01", periodEnd: "2025-12-31" };
  const allNull = {
    totalHeatEnergyKwh: null,
    districtHeatEmissionsKgPerYear: null,
    districtHeatPrimaryEnergyFactor: null,
  };

  it("die Heizkostenkonfiguration nimmt die Werte nicht mehr an", () => {
    const result = heatingSettingsWriteSchema.safeParse({
      ...internalBase,
      consumptionSharePercent: 70,
      baseSharePercent: 30,
      totalHeatEnergyKwh: 42_000,
    });

    expect(result.success).toBe(false);
  });

  it("verlangt alle drei Werte, jeweils Zahl oder null", () => {
    expect(
      heatingPeriodValuesWriteSchema.safeParse({ ...period, ...allNull })
        .success,
    ).toBe(true);
    expect(
      heatingPeriodValuesWriteSchema.safeParse({
        ...period,
        totalHeatEnergyKwh: 42_000,
        districtHeatEmissionsKgPerYear: null,
      }).success,
    ).toBe(false);
  });

  it.each([
    { totalHeatEnergyKwh: 0 },
    { districtHeatEmissionsKgPerYear: -1 },
    { districtHeatPrimaryEnergyFactor: 0 },
    { districtHeatPrimaryEnergyFactor: 10.1 },
  ])("lehnt ungültige Werte ab: %o", (override) => {
    expect(
      heatingPeriodValuesWriteSchema.safeParse({
        ...period,
        ...allNull,
        ...override,
      }).success,
    ).toBe(false);
  });

  it("lehnt ein Ende vor dem Beginn ab", () => {
    expect(
      heatingPeriodValuesWriteSchema.safeParse({
        ...allNull,
        periodStart: "2025-12-31",
        periodEnd: "2025-01-01",
      }).success,
    ).toBe(false);
  });

  it("liest kWh mit Tausenderpunkt und den Faktor als Dezimalzahl", () => {
    expect(
      heatingPeriodValuesFormToDto(
        {
          totalHeatEnergyKwh: "42.000",
          districtHeatEmissionsKgPerYear: "",
          districtHeatPrimaryEnergyFactor: "0.280",
        },
        { start: "2025-01-01", end: "2025-12-31" },
      ),
    ).toEqual({
      ...period,
      totalHeatEnergyKwh: 42_000,
      districtHeatEmissionsKgPerYear: null,
      districtHeatPrimaryEnergyFactor: 0.28,
    });
  });

  it("gibt Werten nur im internen Modus Bedeutung", () => {
    expect(
      heatingPeriodValueRelevance({
        mode: "internal",
        heatingType: "central_with_hot_water",
        fuelType: "gas",
      }),
    ).toEqual({ totalHeatEnergy: true, districtHeat: false });
    expect(
      heatingPeriodValueRelevance({
        mode: "internal",
        heatingType: "central_without_hot_water",
        fuelType: "district_heat",
      }),
    ).toEqual({ totalHeatEnergy: false, districtHeat: true });
    expect(
      heatingPeriodValueRelevance({
        mode: "external",
        heatingType: "central_with_hot_water",
        fuelType: "district_heat",
      }),
    ).toEqual({ totalHeatEnergy: false, districtHeat: false });
  });
});

describe("Angaben zum Nachweis einer Beschränkung nach § 9 CO2KostAufG", () => {
  const write = (fields: Record<string, unknown>) =>
    heatingSettingsWriteSchema.safeParse({
      ...internalBase,
      consumptionSharePercent: 70,
      baseSharePercent: 30,
      ...fields,
    });

  it("belegt die Angaben vor, wenn der Aufrufer sie weglässt", () => {
    expect(write({}).data).toMatchObject({
      co2BuildingRestricted: false,
      co2SupplyRestricted: false,
      co2RestrictionEvidenceNote: null,
    });
  });

  it("verlangt den Text, sobald eine Angabe gesetzt ist", () => {
    expect(write({ co2BuildingRestricted: true }).success).toBe(false);
    expect(
      write({ co2SupplyRestricted: true, co2RestrictionEvidenceNote: "   " })
        .success,
    ).toBe(false);
    expect(
      write({
        co2SupplyRestricted: true,
        co2RestrictionEvidenceNote: "Fernwärmesatzung",
      }).success,
    ).toBe(true);
  });

  it("verlangt keinen Text bei ausgeschalteter Aufteilung", () => {
    expect(
      write({ co2CostShareEnabled: false, co2BuildingRestricted: true })
        .success,
    ).toBe(true);
  });

  it("lehnt einen Text über 2000 Zeichen ab", () => {
    expect(
      write({
        co2BuildingRestricted: true,
        co2RestrictionEvidenceNote: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("meldet den fehlenden Text im Formular am Textfeld", () => {
    const result = heatingFormSchema.safeParse({
      ...emptyHeatingFormValues(
        "3f2b8c1e-9d4a-4e6f-8b7a-1c2d3e4f5a6b",
        "2026-01-01",
      ),
      co2BuildingRestricted: true,
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["co2RestrictionEvidenceNote"],
    ]);
  });
});

describe("Keine Heizkostenabrechnung", () => {
  const none = { mode: "none", validFrom: "2025-01-01", validTo: null };

  it("nimmt nur die Gültigkeit an", () => {
    expect(heatingSettingsWriteSchema.safeParse(none).success).toBe(true);
    expect(
      heatingSettingsWriteSchema.safeParse({
        ...none,
        heatingType: "central_with_hot_water",
        hotWaterSupplyTemperatureCelsius: 60,
      }).success,
    ).toBe(false);
    expect(
      heatingSettingsWriteSchema.safeParse({
        ...none,
        validTo: "2024-12-31",
      }).success,
    ).toBe(false);
  });

  it("kennt dezentrale Heizung nicht mehr als Heizungsart", () => {
    expect(
      heatingSettingsWriteSchema.safeParse({
        ...internalBase,
        heatingType: "decentralized",
        consumptionSharePercent: 70,
        baseSharePercent: 30,
      }).success,
    ).toBe(false);
  });

  it("übergibt aus dem Formular nur die Gültigkeit, ohne die übrigen Felder zu prüfen", () => {
    const values = {
      ...emptyHeatingFormValues(crypto.randomUUID(), "2025-01-01"),
      mode: "none" as const,
      consumptionSharePercent: "",
      validTo: "2025-12-31",
    };

    expect(heatingFormSchema.safeParse(values).success).toBe(true);
    expect(heatingFormToDto(values)).toEqual({
      mode: "none",
      validFrom: "2025-01-01",
      validTo: "2025-12-31",
    });
  });
});
