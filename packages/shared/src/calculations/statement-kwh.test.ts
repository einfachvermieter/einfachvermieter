import { createI18nSync, createTranslate } from "@einfachvermieter/i18n";
import { describe, expect, it } from "vitest";
import type { MeterInfo, UnitInfo } from "../types/index.js";
import { calculateStatement, type StatementCalculationInput } from "./index.js";
import type { MeterBundle } from "./virtualMeter.js";

const translate = createTranslate(createI18nSync());

const period = { start: "2025-01-01", end: "2025-12-31" };

const unit = (id: string, areaSqm: number): UnitInfo => ({
  id,
  name: id,
  areaSqm,
  occupantCount: 1,
  personDays: 365,
  occupiedDays: 365,
  periodDays: 365,
});

const units = [unit("u-eg", 80), unit("u-og", 120)];

const kwhMeter = (
  id: string,
  role: MeterInfo["role"],
  unitId: string | null,
  endValue: number,
  differenceConfig: MeterBundle["differenceConfig"] = null,
): MeterBundle => ({
  meter: {
    id,
    type: "electricity",
    role,
    unitId,
    label: id,
    measurementUnit: "kwh",
    validFrom: "1900-01-01",
    validUntil: null,
  },
  readings:
    role === "virtual_difference"
      ? []
      : [
          {
            date: period.start,
            value: 0,
            isCumulative: true,
            isEstimated: false,
          },
          {
            date: period.end,
            value: endValue,
            isCumulative: true,
            isEstimated: false,
          },
        ],
  differenceConfig,
});

/**
 * Wärmepumpenstrom 1.000 €, verteilt nach den zugeordneten Zählern
 */
const input = (
  overrides: Partial<StatementCalculationInput> & { meterIds?: string[] },
): StatementCalculationInput => ({
  period,
  units,
  targetTenantId: "t-eg",
  targetUnitId: "u-eg",
  costTypes: [
    {
      id: "ct-hp",
      name: "Wärmepumpenstrom",
      allocationKey: "per_consumption_kwh",
      meterIds: overrides.meterIds ?? ["m-eg", "m-og"],
      costs: [
        {
          id: "c-hp",
          costTypeId: "ct-hp",
          allocationKey: "per_consumption_kwh",
          name: "Wärmepumpenstrom",
          amountCents: 100_000,
          periodStart: period.start,
          periodEnd: period.end,
        },
      ],
    },
  ],
  waterMeters: [],
  kwhMeters: [
    kwhMeter("m-eg", "unit", "u-eg", 3000),
    kwhMeter("m-og", "unit", "u-og", 1000),
    // Nicht zugeordnet (z. B. Allgemeinstrom): zählt nicht mit
    kwhMeter("m-common", "unit", "u-og", 9000),
  ],
  totalAdvancesCents: 0,
  translate,
  ...overrides,
});

describe("calculateStatement mit Umlageschlüssel Verbrauch (kWh)", () => {
  it("verteilt nach den zugeordneten Zählern", () => {
    const [line] = calculateStatement(input({})).lines;

    expect(line?.allocationKey).toBe("per_consumption_kwh");
    expect(line?.totalBase).toBe(4000);
    expect(line?.tenantBase).toBe(3000);
    expect(line?.bemessungUnit).toBe("kWh");
    expect(line?.tenantAmountCents).toBe(75_000);
  });

  it("löst Differenzzähler über nicht zugeordnete Quellen auf", () => {
    const result = calculateStatement(
      input({
        meterIds: ["m-eg", "m-og-diff"],
        kwhMeters: [
          kwhMeter("m-main", "main", null, 5000),
          kwhMeter("m-eg", "unit", "u-eg", 3000),
          kwhMeter("m-og-diff", "virtual_difference", "u-og", 0, {
            baseMeterId: "m-main",
            subtractedMeterIds: ["m-eg"],
          }),
        ],
      }),
    );

    expect(result.lines[0]?.totalBase).toBe(5000);
    expect(result.lines[0]?.tenantAmountCents).toBe(60_000);
  });

  it("gibt Verbrauch vor dem Einzug dem Vermieter", () => {
    const [line] = calculateStatement(
      input({ tenantPeriod: { start: "2025-07-02", end: period.end } }),
    ).lines;

    // Der Zähler wird zum Einzug interpoliert; was davor lief, trägt der
    // Vermieter. Zusammen bleibt es beim Anteil der Wohnung.
    expect(line?.tenantAmountCents).toBeGreaterThan(0);
    expect(line?.landlordAmountCents).toBeGreaterThan(0);
    expect(
      (line?.tenantAmountCents ?? 0) + (line?.landlordAmountCents ?? 0),
    ).toBe(75_000);
  });

  it("warnt bei einer Wohnung ohne zugeordneten Zähler", () => {
    expect(calculateStatement(input({})).kwhWarnings).toBeUndefined();

    const result = calculateStatement(input({ meterIds: ["m-eg"] }));

    expect(result.kwhWarnings).toEqual([
      {
        code: "kwhUnitWithoutMeter",
        params: { label: "u-og", costTypeName: "Wärmepumpenstrom" },
      },
    ]);
    expect(result.lines[0]?.tenantAmountCents).toBe(100_000);
  });

  it("verlangt mindestens einen zugeordneten Zähler", () => {
    expect(() => calculateStatement(input({ meterIds: [] }))).toThrow(
      /allocationKwhNoMeters/u,
    );
  });

  it("verlangt gemessenen Verbrauch", () => {
    expect(() =>
      calculateStatement(
        input({
          kwhMeters: [
            kwhMeter("m-eg", "unit", "u-eg", 0),
            kwhMeter("m-og", "unit", "u-og", 0),
          ],
        }),
      ),
    ).toThrow(/allocationKwhNoConsumption/u);
  });
});
