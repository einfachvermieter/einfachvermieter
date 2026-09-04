import { describe, expect, it } from "vitest";
import {
  applyContractPeriod,
  closeOpenPeriods,
  type TenantFormValues,
} from "./tenant-form.js";

const baseValues = (
  overrides: Partial<TenantFormValues> = {},
): TenantFormValues =>
  ({
    unitId: "unit-1",
    kind: "private",
    startDate: "2026-03-01",
    endDate: "",
    depositEuros: "0,00",
    notes: "",
    residents: [],
    rents: [],
    bankAccounts: [],
    addresses: [],
    ...overrides,
  }) as TenantFormValues;

const rent = (startDate: string, endDate: string) => ({
  startDate,
  endDate,
  monthlyBaseRentEuros: "1200,00",
  monthlyAdvanceEuros: "350,00",
  reductionReason: "",
});

describe("applyContractPeriod", () => {
  it("zieht den ersten Mietsatz auf den neuen Vertragsbeginn", () => {
    const result = applyContractPeriod(
      baseValues({ rents: [rent("2026-03-01", "")] }),
      { startDate: "2026-04-01", endDate: "" },
    );

    expect(result.startDate).toBe("2026-04-01");
    expect(result.rents[0]?.startDate).toBe("2026-04-01");
  });

  it("kappt ein gesetztes Ende auf das neue Vertragsende", () => {
    const result = applyContractPeriod(
      baseValues({ rents: [rent("2026-03-01", "2027-06-30")] }),
      { startDate: "2026-03-01", endDate: "2026-12-31" },
    );

    expect(result.rents[0]?.endDate).toBe("2026-12-31");
  });

  it("lässt ein offenes Ende offen: es meint das Vertragsende", () => {
    const result = applyContractPeriod(
      baseValues({ rents: [rent("2026-03-01", "")] }),
      { startDate: "2026-03-01", endDate: "2026-12-31" },
    );

    expect(result.rents[0]?.endDate).toBe("");
  });

  it("entfernt Mietsätze, die komplett vor dem neuen Beginn liegen", () => {
    const result = applyContractPeriod(
      baseValues({
        rents: [rent("2026-03-01", "2026-05-31"), rent("2026-06-01", "")],
      }),
      { startDate: "2026-06-01", endDate: "" },
    );

    expect(result.rents).toHaveLength(1);
    expect(result.rents[0]?.startDate).toBe("2026-06-01");
  });

  it("lässt ein leeres Startdatum leer: es meint den Vertragsbeginn", () => {
    const result = applyContractPeriod(baseValues({ rents: [rent("", "")] }), {
      startDate: "2026-04-01",
      endDate: "",
    });

    expect(result.rents[0]?.startDate).toBe("");
  });

  it("schiebt Einzugsdaten von Bewohnern mit", () => {
    const result = applyContractPeriod(
      baseValues({
        residents: [
          {
            residentId: "r1",
            isContractParty: true,
            moveInDate: "2026-03-01",
            moveOutDate: "",
          },
        ] as TenantFormValues["residents"],
      }),
      { startDate: "2026-04-01", endDate: "" },
    );

    expect(result.residents[0]?.moveInDate).toBe("2026-04-01");
  });
});

describe("closeOpenPeriods", () => {
  it("schließt den laufenden Satz am Tag vor der Mietänderung", () => {
    const result = closeOpenPeriods(
      [rent("", ""), rent("2026-06-01", "")],
      "2026-01-01",
    );

    expect(result[0]?.endDate).toBe("2026-05-31");
    expect(result[1]?.endDate).toBe("");
  });

  it("lässt ein früheres Ende unangetastet", () => {
    const result = closeOpenPeriods(
      [rent("2026-01-01", "2026-03-31"), rent("2026-06-01", "")],
      "2026-01-01",
    );

    expect(result[0]?.endDate).toBe("2026-03-31");
  });
});
