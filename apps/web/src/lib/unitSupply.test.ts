import { describe, expect, it } from "vitest";
import {
  supplyIssuesOf,
  unitSupplyFormSchema,
  unitSupplyFormToDto,
} from "./unitSupply";

describe("unitSupplyFormToDto", () => {
  it("macht aus leeren Feldern null und schneidet die Notiz zu", () => {
    expect(
      unitSupplyFormToDto({
        scope: "hot_water",
        validFrom: "2027-07-01",
        validUntil: "",
        notes: "   ",
      }),
    ).toEqual({
      scope: "hot_water",
      validFrom: "2027-07-01",
      validUntil: null,
      notes: null,
    });

    expect(
      unitSupplyFormToDto({
        scope: "heating",
        validFrom: "2027-07-01",
        validUntil: "2027-12-31",
        notes: "  Etagenheizung  ",
      }),
    ).toEqual({
      scope: "heating",
      validFrom: "2027-07-01",
      validUntil: "2027-12-31",
      notes: "Etagenheizung",
    });
  });
});

describe("unitSupplyFormSchema", () => {
  const values = {
    scope: "heating",
    validFrom: "2027-07-01",
    validUntil: "",
    notes: "",
  };

  it("verlangt einen Beginn und lässt das Ende offen", () => {
    expect(unitSupplyFormSchema.safeParse(values).success).toBe(true);
    expect(
      unitSupplyFormSchema.safeParse({ ...values, validFrom: "" }).success,
    ).toBe(false);
  });

  it("weist ein Ende vor dem Beginn am Ende-Feld zurück", () => {
    const result = unitSupplyFormSchema.safeParse({
      ...values,
      validUntil: "2027-06-30",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["validUntil"]);
    expect(
      unitSupplyFormSchema.safeParse({ ...values, validUntil: "2027-07-01" })
        .success,
    ).toBe(true);
  });
});

describe("supplyIssuesOf", () => {
  it("übernimmt nur Warnungen zur zentralen Versorgung", () => {
    const issues = supplyIssuesOf([
      { code: "readingEstimated" },
      {
        code: "consumptionMeterMissingHotWater",
        params: { unitId: "unit-1", unit: "EG", scope: "hot_water" },
      },
      {
        code: "supplyBoundaryReadingMissing",
        params: {
          unitId: "unit-2",
          unit: "OG",
          scope: "heating",
          meterId: "meter-1",
          meter: "WMZ",
          date: "2027-07-01",
        },
      },
    ]);

    expect(issues.map((issue) => issue.kind)).toEqual([
      "meterMissing",
      "boundary",
    ]);
    expect(issues[0]).toMatchObject({ unitId: "unit-1", scope: "hot_water" });
    expect(issues[1]).toMatchObject({
      unitId: "unit-2",
      scope: "heating",
      meterId: "meter-1",
      date: "2027-07-01",
    });
  });

  it("liefert ohne Warnungen eine leere Liste", () => {
    expect(supplyIssuesOf(undefined)).toEqual([]);
  });
});
