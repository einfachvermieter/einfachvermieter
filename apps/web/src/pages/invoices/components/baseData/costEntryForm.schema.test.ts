import { describe, expect, it } from "vitest";
import {
  costEntryFormSchema,
  costEntryFormToDto,
  costEntryToFormValues,
  emptyItem,
} from "./costEntryForm.schema";

const formWith = (co2: { energy?: string; factor?: string }) => ({
  buildingId: "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b",
  invoiceDate: "2025-02-01",
  invoiceNumber: "",
  vendor: "",
  items: [
    {
      ...emptyItem("gas"),
      amountInput: "100,00",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      co2EnergyInput: co2.energy ?? "",
      co2EmissionFactorInput: co2.factor ?? "",
    },
  ],
});

const accepts = (co2: { energy?: string; factor?: string }) =>
  costEntryFormSchema.safeParse(formWith(co2)).success;

describe("Rechnungsformular - Energiegehalt und Emissionsfaktor", () => {
  it("nimmt beide Felder leer und mit Komma an", () => {
    expect(accepts({})).toBe(true);
    expect(accepts({ energy: "44000,5", factor: "0,20088" })).toBe(true);
    expect(accepts({ energy: "0,5", factor: "0,181397" })).toBe(true);
  });

  it("lehnt mehr als sechs Nachkommastellen, null und einen Faktor über 1 ab", () => {
    expect(accepts({ factor: "0,2008801" })).toBe(false);
    expect(accepts({ factor: "0" })).toBe(false);
    expect(accepts({ factor: "200,88" })).toBe(false);
    expect(accepts({ energy: "44000,1234" })).toBe(false);
  });

  it("zeigt gespeicherte Werte im festen Format wieder an", () => {
    const dto = costEntryFormToDto(
      formWith({ energy: "44000", factor: "0,201" }),
      [],
    );
    expect(dto.items[0]).toMatchObject({
      co2EnergyKwh: 44_000,
      co2EmissionFactorKgPerKwh: 0.201,
    });

    const [item] = costEntryToFormValues(
      { ...dto, invoiceNumber: null, vendor: null },
      [],
    ).items;
    expect(item?.co2EnergyInput).toBe("44000");
    expect(item?.co2EmissionFactorInput).toBe("0,2010");
  });
});
