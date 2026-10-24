import { describe, expect, it } from "vitest";
import { unitFormSchema, unitFormToDto } from "./units.js";

const base = {
  buildingId: "0193b4c2-1a2b-7c3d-8e4f-5a6b7c8d9e0f",
  name: "EG",
  unitNumber: "",
  areaSqm: "64",
};

describe("Wohnung – abweichende Heizfläche", () => {
  it("verlangt die Heizfläche, wenn eine Abweichung angegeben ist", () => {
    const result = unitFormSchema.safeParse({
      ...base,
      heatingAreaDiffers: true,
      heatingAreaSqm: "",
    });
    expect(result.success).toBe(false);
  });

  it("prüft die Heizfläche ohne Abweichung nicht", () => {
    const result = unitFormSchema.safeParse({
      ...base,
      heatingAreaDiffers: false,
      heatingAreaSqm: "abc",
    });
    expect(result.success).toBe(true);
  });

  it("speichert ohne Abweichung keine Heizfläche, auch wenn eine eingetippt war", () => {
    const dto = unitFormToDto({
      ...base,
      heatingAreaDiffers: false,
      heatingAreaSqm: "50",
    });
    expect(dto.heatingAreaSqm).toBeNull();
  });

  it("übernimmt die Heizfläche bei Abweichung", () => {
    const dto = unitFormToDto({
      ...base,
      heatingAreaDiffers: true,
      heatingAreaSqm: "50,5",
    });
    expect(dto.heatingAreaSqm).toBe(50.5);
  });
});
