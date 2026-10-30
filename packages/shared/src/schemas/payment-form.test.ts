import { describe, expect, it } from "vitest";
import {
  distributeMonthSum,
  emptyPaymentFormValues,
  openPotCents,
  paymentFormToDto,
} from "./payment-form.js";

/**
 * Offene Beträge aus Soll und schon gezahltem Ist, dann verteilen
 */
const distribute = (
  sum: number,
  soll: { advance: number; base: number },
  paid: { advance: number; base: number },
) =>
  distributeMonthSum(
    sum,
    openPotCents(soll.advance, paid.advance),
    openPotCents(soll.base, paid.base),
  );

const SOLL = { advance: 200, base: 800 };
const NOTHING = { advance: 0, base: 0 };

describe("distributeMonthSum", () => {
  it.each([
    [150, NOTHING, { advanceCents: 150, baseRentCents: 0 }],
    [200, NOTHING, { advanceCents: 200, baseRentCents: 0 }],
    [500, NOTHING, { advanceCents: 200, baseRentCents: 300 }],
    [1000, NOTHING, { advanceCents: 200, baseRentCents: 800 }],
    [400, { advance: 200, base: 300 }, { advanceCents: 0, baseRentCents: 400 }],
    [400, { advance: 0, base: 300 }, { advanceCents: 200, baseRentCents: 200 }],
  ])("verteilt %i zuerst auf die NK-Vorauszahlung", (sum, paid, expected) => {
    expect(distribute(sum, SOLL, paid)).toEqual(expected);
  });

  it("weist eine Summe über dem offenen Betrag ab", () => {
    expect(distribute(600, SOLL, { advance: 200, base: 300 })).toBeNull();
    expect(distribute(1100, SOLL, NOTHING)).toBeNull();
  });

  it("lässt die Kaltmiete voll offen, wenn die NK überzahlt sind", () => {
    expect(distribute(800, SOLL, { advance: 300, base: 0 })).toEqual({
      advanceCents: 0,
      baseRentCents: 800,
    });
    expect(distribute(801, SOLL, { advance: 300, base: 0 })).toBeNull();
  });

  it("gibt bei NK-Soll 0 alles auf die Kaltmiete", () => {
    expect(distribute(500, { advance: 0, base: 800 }, NOTHING)).toEqual({
      advanceCents: 0,
      baseRentCents: 500,
    });
  });

  it("weist bei ganz bezahltem Monat jede Summe ab", () => {
    expect(distribute(1, SOLL, SOLL)).toBeNull();
  });

  it("ergibt in den Teilen immer genau die Summe", () => {
    for (const sum of [1, 199, 200, 201, 999, 1000]) {
      const result = distribute(sum, SOLL, NOTHING);
      expect((result?.advanceCents ?? 0) + (result?.baseRentCents ?? 0)).toBe(
        sum,
      );
    }
  });
});

describe("paymentFormToDto", () => {
  const values = (direction: "received" | "paidOut") => ({
    ...emptyPaymentFormValues({
      tenantId: "tenant",
      paymentDate: "2026-10-30",
      purposeKind: "deposit",
    }),
    amountInput: "50,00",
    direction,
  });

  it("bucht einen erhaltenen Betrag positiv", () => {
    expect(paymentFormToDto(values("received")).purpose).toEqual({
      kind: "deposit",
      amountCents: 5000,
    });
  });

  it("bucht eine Auszahlung an den Mieter negativ", () => {
    expect(paymentFormToDto(values("paidOut")).purpose).toEqual({
      kind: "deposit",
      amountCents: -5000,
    });
  });
});
