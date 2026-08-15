import { describe, expect, it } from "vitest";
import { type MeterFormValues, meterFormToDto } from "./meters.js";

const translate = (key: string) => key;

const baseValues: MeterFormValues = {
  buildingId: "11111111-1111-4111-8111-111111111111",
  type: "water_cold",
  role: "unit",
  label: "",
  serialNumber: "SN-1",
  unitId: "22222222-2222-4222-8222-222222222222",
  room: "EG",
  gasFactors: [],
  radiator: "",
  kTotal: "",
  radiatorManufacturer: "",
  radiatorModel: "",
  radiatorType: "",
  radiatorDimensions: "",
  isRemoteReadable: false,
  validFrom: "2026-01-01",
  validUntil: "",
  costAllocationMode: "cost_types",
  costTypeIds: [],
  baseMeterId: "",
  subtractedMeterIds: [],
};

describe("meterFormToDto - Bezeichnung", () => {
  it("erzeugt den Namen aus Art, Rolle und Raum, wenn das Feld leer bleibt", () => {
    expect(meterFormToDto(baseValues, translate).label).toBe(
      "meters.types.water_cold meters.roles.unit EG",
    );
  });

  it("behält eine eingegebene Bezeichnung bei", () => {
    expect(
      meterFormToDto({ ...baseValues, label: "Kaltwasser EG" }, translate)
        .label,
    ).toBe("Kaltwasser EG");
  });
});
