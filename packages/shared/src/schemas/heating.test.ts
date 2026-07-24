import { describe, expect, it } from "vitest";
import { heatingSettingsWriteSchema } from "./heating.js";

const internalBase = {
  mode: "internal" as const,
  validFrom: "2025-01-01",
  validTo: null,
  baseMethod: "area" as const,
  consumptionMethod: "heat_meter" as const,
  prorationMethod: "linear" as const,
  heatingType: "central_without_hot_water" as const,
  fuelType: "gas" as const,
  hotWaterMeterId: null,
  hotWaterSupplyTemperatureCelsius: 60,
  totalHeatEnergyKwh: null,
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
