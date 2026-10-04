import type { ConsumptionSubstitution } from "@einfachvermieter/shared";
import { describe, expect, it } from "vitest";
import {
  initialSubstitutionFormValues,
  type SubstitutionFormValues,
  substitutionFormToDto,
} from "./substitutionForm";
import type { SubstitutionOptions } from "./substitutions";

const period = { start: "2025-01-01", end: "2025-12-31" };

const options: SubstitutionOptions = {
  meters: [
    { id: "meter-1", label: "HKV Wohnen", isContinuous: false, hasGap: true },
    { id: "meter-2", label: "HKV Küche", isContinuous: true, hasGap: false },
  ],
  unitMeterCount: 2,
  allMeters: [],
  wholeUnitAreaSqm: 70,
  shareMethod: true,
  referenceYears: [],
  comparisonUnits: [],
};

const baseValues: SubstitutionFormValues = {
  unitId: "unit-1",
  scope: "heating",
  reason: "device_failure",
  reasonNote: "wird verworfen",
  affectedMeterIds: ["meter-1"],
  meterKeptCounting: false,
  affectedAreaSqm: "12,5",
  method: "same_rooms_comparable_period",
  basisSource: "meter_readings",
  referenceYears: "1",
  useOtherReferenceMeters: false,
  referenceMeterIds: ["meter-9"],
  useGroup: false,
  comparisonUnitIds: ["unit-2"],
  manualAffectedConsumption: "1.234,5",
  manualTotalConsumption: "5000",
  manualComparisonConsumption: "800",
  manualComparisonAreaSqm: "65",
  basisNote: "wird verworfen",
};

describe("substitutionFormToDto", () => {
  it("verschiebt den Vergleichszeitraum um die gewählten Jahre und verwirft fremde Felder", () => {
    const dto = substitutionFormToDto(baseValues, options, period);

    expect(dto).toMatchObject({
      unitId: "unit-1",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      referencePeriodStart: "2024-01-01",
      referencePeriodEnd: "2024-12-31",
      // Nur ein Teil der Zähler ist betroffen, also zählt die Teilfläche.
      affectedAreaSqm: 12.5,
      // Der betroffene Zähler läuft nicht durchgehend weiter.
      meterKeptCounting: null,
      reasonNote: null,
      referenceMeterIds: null,
      comparisonUnitIds: null,
      manualAffectedConsumption: null,
      manualTotalConsumption: null,
      manualComparisonConsumption: null,
      manualComparisonAreaSqm: null,
      basisNote: null,
    });
  });

  it("liest von Hand belegte Werte in deutscher Schreibweise", () => {
    const dto = substitutionFormToDto(
      { ...baseValues, basisSource: "manual_reference", basisNote: " Beleg " },
      options,
      period,
    );

    expect(dto.manualAffectedConsumption).toBe(1234.5);
    expect(dto.manualTotalConsumption).toBe(5000);
    expect(dto.basisNote).toBe("Beleg");
    expect(dto.referenceMeterIds).toBeNull();
  });

  it("lässt die Fläche weg, wenn die ganze Wohnung betroffen ist", () => {
    const dto = substitutionFormToDto(
      { ...baseValues, affectedMeterIds: ["meter-1", "meter-2"] },
      options,
      period,
    );

    expect(dto.affectedAreaSqm).toBeNull();
    expect(dto.meterKeptCounting).toBe(false);
  });

  it("gibt Vergleichswohnungen nur bei den passenden Verfahren mit", () => {
    const comparable = substitutionFormToDto(
      { ...baseValues, method: "comparable_rooms" },
      options,
      period,
    );
    expect(comparable.comparisonUnitIds).toEqual(["unit-2"]);
    expect(comparable.referencePeriodStart).toBeNull();

    const average = { ...baseValues, method: "building_or_group_average" };
    expect(
      substitutionFormToDto(average, options, period).comparisonUnitIds,
    ).toBeNull();
    expect(
      substitutionFormToDto({ ...average, useGroup: true }, options, period)
        .comparisonUnitIds,
    ).toEqual(["unit-2"]);
  });

  it("behält den Freitext nur beim Grund Sonstiges", () => {
    const dto = substitutionFormToDto(
      { ...baseValues, reason: "other", reasonNote: " Wasserschaden " },
      options,
      period,
    );

    expect(dto.reasonNote).toBe("Wasserschaden");
  });
});

describe("initialSubstitutionFormValues", () => {
  it("füllt ein neues Formular mit den Vorgaben des Aufrufs", () => {
    const values = initialSubstitutionFormValues(
      {
        kind: "new",
        units: [],
        scopes: ["hot_water"],
        unitId: "unit-1",
        scope: "hot_water",
        meterIds: ["meter-1"],
      },
      period,
    );

    expect(values).toMatchObject({
      unitId: "unit-1",
      scope: "hot_water",
      affectedMeterIds: ["meter-1"],
      basisSource: "meter_readings",
      method: "",
    });
  });

  it("übersetzt einen gespeicherten Ausfall zurück in Formularwerte", () => {
    const dto = substitutionFormToDto(
      {
        ...baseValues,
        referenceYears: "2",
        basisSource: "manual_reference",
        basisNote: "Beleg",
      },
      options,
      period,
    );
    const values = initialSubstitutionFormValues(
      {
        kind: "edit",
        units: [],
        scopes: ["heating"],
        record: { id: "substitution-1", ...dto } as ConsumptionSubstitution,
      },
      period,
    );

    expect(values).toMatchObject({
      referenceYears: "2",
      affectedAreaSqm: "12,50",
      manualAffectedConsumption: "1234,50",
      manualTotalConsumption: "5000,00",
      meterKeptCounting: true,
      useOtherReferenceMeters: false,
      basisNote: "Beleg",
    });
  });
});
