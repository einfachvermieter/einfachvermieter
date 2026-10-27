import { describe, expect, it } from "vitest";
import {
  applyContractPeriod,
  closeOpenPeriods,
  type TenantFormValues,
  tenantFormSchemaRefined,
  tenantFormToDto,
} from "./tenant-form.js";

const baseValues = (
  overrides: Partial<TenantFormValues> = {},
): TenantFormValues =>
  ({
    unitId: "unit-1",
    kind: "private",
    rentType: "standard",
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
  changeReason: "none" as const,
  changeNote: "",
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

describe("tenantFormSchemaRefined: Änderungsgrund", () => {
  const withRaise = (
    changeReason: TenantFormValues["rents"][number]["changeReason"],
    monthlyBaseRentEuros: string,
  ) =>
    baseValues({
      residents: [
        {
          firstName: "Rita",
          lastName: "Muster",
          email: "",
          phone: "",
          moveInDate: "",
          moveOutDate: "",
          isContractParty: true,
        },
      ],
      // Reihenfolge der Eingabe: der spätere Satz steht vorn
      rents: [
        { ...rent("2026-06-01", ""), monthlyBaseRentEuros, changeReason },
        rent("", "2026-05-31"),
      ],
    });

  const reasonIssues = (values: TenantFormValues) => {
    const result = tenantFormSchemaRefined.safeParse(values);
    return result.success
      ? []
      : result.error.issues.filter((issue) => issue.path[2] === "changeReason");
  };

  it("weist Modernisierung mit niedrigerer Kaltmiete am richtigen Satz ab", () => {
    const issues = reasonIssues(withRaise("modernization", "1100,00"));
    expect(issues.map((issue) => issue.path)).toEqual([
      ["rents", 0, "changeReason"],
    ]);
  });

  it("erlaubt eine vereinbarte Senkung und eine Modernisierung mit Erhöhung", () => {
    expect(reasonIssues(withRaise("agreement", "1100,00"))).toEqual([]);
    expect(reasonIssues(withRaise("modernization", "1300,00"))).toEqual([]);
  });

  it("überträgt Grund, Notiz und Mietart ins DTO", () => {
    const dto = tenantFormToDto({
      ...withRaise("modernization", "1300,00"),
      rentType: "graduated",
      rents: [
        {
          ...rent("", ""),
          changeReason: "agreement",
          changeNote: "  Fenster neu  ",
        },
      ],
    });
    expect(dto.rentType).toBe("graduated");
    expect(dto.rents[0]).toMatchObject({
      changeReason: "agreement",
      changeNote: "Fenster neu",
    });
    expect(
      tenantFormToDto({ ...withRaise("none", "1300,00"), kind: "owner" })
        .rentType,
    ).toBe("standard");
  });
});
