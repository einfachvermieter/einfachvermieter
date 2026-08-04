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
