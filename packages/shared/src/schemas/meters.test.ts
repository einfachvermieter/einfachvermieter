import { describe, expect, it } from "vitest";
import {
  type MeterFormValues,
  meterFormToDto,
  RESET_DAY_NONE,
} from "./meters.js";

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
  resetDay: RESET_DAY_NONE,
  validFrom: "2026-01-01",
  validUntil: "",
  costAllocationMode: "cost_types",
  costTypeIds: [],
  baseMeterId: "",
  subtractedMeterIds: [],
};

describe("meterFormToDto - Kostenarten-Zuordnung", () => {
  const costTypeIds = ["33333333-3333-4333-8333-333333333333"];
  const heatingBill = {
    ...baseValues,
    costAllocationMode: "heating_cost_bill" as const,
    costTypeIds,
  };

  it("behält die Zuordnung eines Warmwasserzählers in der Heizkostenabrechnung", () => {
    expect(
      meterFormToDto({ ...heatingBill, type: "water_hot" }, translate)
        .costTypeIds,
    ).toEqual(costTypeIds);
  });

  it("verwirft sie bei anderen Zählern in der Heizkostenabrechnung", () => {
    expect(
      meterFormToDto({ ...heatingBill, type: "heat_meter" }, translate)
        .costTypeIds,
    ).toEqual([]);
  });
});

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
