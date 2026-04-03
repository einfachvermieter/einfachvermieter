import { describe, expect, it } from "vitest";
import { operatingCostStatementCancelSchema } from "./core.js";
import { accountFeeCreateSchema } from "./tenant-account.js";

const tenantId = "11111111-1111-1111-1111-111111111111";

describe("accountFeeCreateSchema - Gutschrift (negativer Betrag)", () => {
  const base = { tenantId, date: "2026-01-15", reason: "Korrektur" };

  it("akzeptiert eine Forderung (positiver Betrag)", () => {
    expect(
      accountFeeCreateSchema.safeParse({ ...base, amountCents: 5000 }).success,
    ).toBe(true);
  });

  it("akzeptiert eine Gutschrift (negativer Betrag)", () => {
    expect(
      accountFeeCreateSchema.safeParse({ ...base, amountCents: -5000 }).success,
    ).toBe(true);
  });

  it("lehnt den Betrag 0 ab", () => {
    expect(
      accountFeeCreateSchema.safeParse({ ...base, amountCents: 0 }).success,
    ).toBe(false);
  });

  it("lehnt Nachkommastellen (Nicht-Integer) ab", () => {
    expect(
      accountFeeCreateSchema.safeParse({ ...base, amountCents: 50.5 }).success,
    ).toBe(false);
  });
});

describe("operatingCostStatementCancelSchema - Stornogrund", () => {
  it("verlangt einen nicht-leeren Grund", () => {
    expect(
      operatingCostStatementCancelSchema.safeParse({ reason: "" }).success,
    ).toBe(false);
    expect(
      operatingCostStatementCancelSchema.safeParse({ reason: "   " }).success,
    ).toBe(false);
  });

  it("akzeptiert einen Grund", () => {
    expect(
      operatingCostStatementCancelSchema.safeParse({
        reason: "Falsche Zählerstände",
      }).success,
    ).toBe(true);
  });
});
