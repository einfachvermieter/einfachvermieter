import { describe, expect, it } from "vitest";
import { heatingDetailSchema } from "./statement-result.js";

describe("heatingDetailSchema - Vermieteranteil (Leerstand/Mieterwechsel)", () => {
  it("behält landlordBasicCostCents/landlordConsumptionCostCents beim Parsen", () => {
    const raw = {
      mode: "internal",
      billingInfoOmitted: false,
      totalHeatingCostsCents: 99_000,
      consumptionShareBps: 7000,
      consumptionPortionCents: 63_462,
      basicPortionCents: 27_000,
      perUnit: [],
      landlordBasicCostCents: 31_400,
      landlordConsumptionCostCents: 16_483,
    };

    const parsed = heatingDetailSchema.parse(raw);

    expect(parsed.landlordBasicCostCents).toBe(31_400);
    expect(parsed.landlordConsumptionCostCents).toBe(16_483);
  });
});

describe("heatingDetailSchema - Ausstoß der CO2-Einstufung", () => {
  const parse = (co2Fields: Record<string, unknown>) =>
    heatingDetailSchema.safeParse({
      mode: "internal",
      billingInfoOmitted: false,
      totalHeatingCostsCents: 99_000,
      consumptionShareBps: 7000,
      consumptionPortionCents: 69_300,
      basicPortionCents: 29_700,
      perUnit: [],
      co2Detail: {
        totalCostCents: 10_000,
        totalAmountGrams: 1_592_000,
        landlordSharePercent: 10,
        landlordDeductionCents: 1000,
        livingAreaSqm: 200,
        ...co2Fields,
      },
    }).success;
  const periodShare = { numerator: 2, denominator: 3 };

  it("nimmt den Jahreswert oder den Wert des kurzen Zeitraums mit Anteil", () => {
    expect(parse({ emissionsKgPerSqmYear: 17.5 })).toBe(true);
    expect(parse({ emissionsKgPerSqmPeriod: 8, periodShare })).toBe(true);
  });

  it("lehnt beide Werte zugleich und keinen Wert ab", () => {
    expect(
      parse({
        emissionsKgPerSqmYear: 11.9,
        emissionsKgPerSqmPeriod: 8,
        periodShare,
      }),
    ).toBe(false);
    expect(parse({})).toBe(false);
  });

  it("lehnt den Wert des kurzen Zeitraums ohne Anteil ab", () => {
    expect(parse({ emissionsKgPerSqmPeriod: 8 })).toBe(false);
    expect(parse({ emissionsKgPerSqmYear: 17.5, periodShare })).toBe(false);
  });
});

describe("heatingDetailSchema - Beschränkung nach § 9 CO2KostAufG", () => {
  const parse = (co2Fields: Record<string, unknown>) =>
    heatingDetailSchema.safeParse({
      mode: "internal",
      billingInfoOmitted: false,
      totalHeatingCostsCents: 99_000,
      consumptionShareBps: 7000,
      consumptionPortionCents: 69_300,
      basicPortionCents: 29_700,
      perUnit: [],
      co2Detail: {
        totalCostCents: 10_000,
        totalAmountGrams: 1_592_000,
        emissionsKgPerSqmYear: 60,
        landlordSharePercent: 47.5,
        landlordDeductionCents: 4750,
        livingAreaSqm: 200,
        ...co2Fields,
      },
    }).success;
  const restriction = (building: boolean, supply: boolean) => ({
    building,
    supply,
    evidenceNote: "Denkmalschutz",
  });
  const half = {
    tableLandlordSharePercent: 95,
    restriction: restriction(true, false),
  };

  it("nimmt halbe Prozent an und lehnt andere Bruchteile ab", () => {
    expect(parse(half)).toBe(true);
    expect(parse({ landlordSharePercent: 47.3 })).toBe(false);
  });

  it("nimmt beide Beschränkungen mit Anteil 0 an", () => {
    expect(
      parse({
        landlordSharePercent: 0,
        tableLandlordSharePercent: 95,
        restriction: restriction(true, true),
      }),
    ).toBe(true);
  });

  it("lehnt Tabellenanteil und Angaben einzeln ab", () => {
    expect(parse({ restriction: restriction(true, false) })).toBe(false);
    expect(
      parse({ landlordSharePercent: 95, tableLandlordSharePercent: 95 }),
    ).toBe(false);
  });

  it("lehnt Angaben ohne gesetzten Bereich ab", () => {
    expect(parse({ ...half, restriction: restriction(false, false) })).toBe(
      false,
    );
  });

  it("lehnt einen Anteil ab, der nicht zu Tabellenanteil und Angaben passt", () => {
    expect(parse({ ...half, landlordSharePercent: 95 })).toBe(false);
    expect(parse({ ...half, restriction: restriction(true, true) })).toBe(
      false,
    );
  });
});
