import { messageKey } from "@einfachvermieter/i18n";
import { describe, expect, it } from "vitest";
import { tenantSaveSchema } from "./tenants.js";

const rent = (startDate: string | null, endDate: string | null) => ({
  startDate,
  endDate,
  monthlyBaseRentCents: 50_000,
  monthlyAdvanceCents: 10_000,
});

const tenantWith = (
  rents: (ReturnType<typeof rent> & { changeReason?: string })[],
) => ({
  unitId: "7b0e6f0a-4f3c-4d7e-9b1a-2f6c1d9e8a10",
  kind: "private",
  startDate: "2025-04-15",
  endDate: "2026-06-10",
  depositCents: 0,
  residents: [
    {
      resident: { firstName: "Rita", lastName: "Muster" },
      isContractParty: true,
    },
  ],
  rents,
});

const messagesOf = (input: unknown): string[] => {
  const result = tenantSaveSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
};

describe("tenantSaveSchema: Beginn eines Mietsatzes", () => {
  it("erlaubt Vertragsbeginn und Vertragsende mitten im Monat", () => {
    expect(messagesOf(tenantWith([rent(null, null)]))).toEqual([]);
    expect(messagesOf(tenantWith([rent("2025-04-15", "2026-06-10")]))).toEqual(
      [],
    );
  });

  it("erlaubt einen Mietsatzwechsel zum Monatsersten", () => {
    expect(
      messagesOf(
        tenantWith([rent(null, "2025-12-31"), rent("2026-01-01", null)]),
      ),
    ).toEqual([]);
  });

  it("weist einen Mietsatzwechsel mitten im Monat ab", () => {
    expect(
      messagesOf(
        tenantWith([rent(null, "2026-01-14"), rent("2026-01-15", null)]),
      ),
    ).toEqual([messageKey("ui.tenant.validation.rentStartFirstOfMonth")]);
  });
});

describe("tenantSaveSchema: Änderungsgrund", () => {
  const chain = (
    changeReason: "agreement" | "comparable_rent" | "modernization" | "index",
    monthlyBaseRentCents: number,
  ) =>
    tenantWith([
      rent(null, "2025-12-31"),
      { ...rent("2026-01-01", null), monthlyBaseRentCents, changeReason },
    ]);

  it.each([
    "comparable_rent",
    "modernization",
  ] as const)("weist %s ohne höhere Kaltmiete ab", (reason) => {
    const expected = [
      messageKey("ui.tenant.validation.changeReasonRequiresIncrease"),
    ];
    expect(messagesOf(chain(reason, 45_000))).toEqual(expected);
    expect(messagesOf(chain(reason, 50_000))).toEqual(expected);
    expect(messagesOf(chain(reason, 55_000))).toEqual([]);
  });

  it.each([
    "agreement",
    "index",
  ] as const)("erlaubt %s mit niedrigerer Kaltmiete", (reason) => {
    expect(messagesOf(chain(reason, 45_000))).toEqual([]);
  });

  it("setzt die Mietart ohne Angabe auf standard", () => {
    const result = tenantSaveSchema.parse(tenantWith([rent(null, null)]));
    expect(result.rentType).toBe("standard");
  });
});
