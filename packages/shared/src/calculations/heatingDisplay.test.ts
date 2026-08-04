import { describe, expect, it } from "vitest";
import { formatNumber } from "../format.js";
import type { HeatingDetail } from "../types/index.js";
import {
  billingInfoCostRows,
  billingInfoRows,
  co2TenantShareCents,
  co2TierLabel,
  consumptionUnitLabel,
  hasHeatingBreakdown,
  hotWaterFactRows,
  perMeterDisplayDigits,
  prepareHeatingDisplay,
  prorationNote,
} from "./heatingDisplay.js";

const period = (start: string, end: string) => ({ start, end });

const baseDetail = (overrides: Partial<HeatingDetail> = {}): HeatingDetail => ({
  mode: "internal",
  billingInfoOmitted: false,
  totalHeatingCostsCents: 100_000,
  consumptionShareBps: 7000,
  consumptionPortionCents: 70_000,
  basicPortionCents: 30_000,
  perUnit: [
    {
      unitId: "a",
      unitName: "WE 1",
      consumptionKwh: 1000,
      consumptionCostCents: 40_000,
      areaSqm: 50,
      basicCostCents: 15_000,
      totalCents: 55_000,
    },
    {
      unitId: "b",
      unitName: "WE 2",
      consumptionKwh: 800,
      consumptionCostCents: 30_000,
      areaSqm: 30,
      basicCostCents: 15_000,
      totalCents: 45_000,
    },
  ],
  ...overrides,
});

describe("prepareHeatingDisplay", () => {
  it("leitet Anteile, Summen und Vollperiode ab", () => {
    const full = period("2024-01-01", "2024-12-31");
    const display = prepareHeatingDisplay(baseDetail(), full, full);

    expect(display.consumptionPct).toBe(70);
    expect(display.basicPct).toBe(30);
    expect(display.isHkv).toBe(false);
    expect(display.distributionMethod).toBe("consumption");
    expect(display.totalConsumption).toBe(1800);
    expect(display.totalArea).toBe(80);
    expect(display.isPartialPeriod).toBe(false);
    // Ohne Warmwasser bleibt der Anzeige-Heiztopf die Gesamtsumme.
    expect(display.heatingPotForDisplay).toBe(100_000);
  });

  it("erkennt unterjährige Nutzung", () => {
    const display = prepareHeatingDisplay(
      baseDetail(),
      period("2024-03-01", "2024-12-31"),
      period("2024-01-01", "2024-12-31"),
    );
    expect(display.isPartialPeriod).toBe(true);
  });

  it("aktiviert Bewertungspunkte erst ab der Schwelle und skaliert / 1.000", () => {
    const full = period("2024-01-01", "2024-12-31");
    const hkv = baseDetail({
      consumptionMethod: "heat_cost_allocator",
      perUnit: [
        {
          unitId: "a",
          unitName: "WE 1",
          consumptionKwh: 10_000_000,
          consumptionCostCents: 40_000,
          areaSqm: 50,
          basicCostCents: 15_000,
          totalCents: 55_000,
        },
      ],
    });
    const display = prepareHeatingDisplay(hkv, full, full);
    expect(display.useValuationPoints).toBe(true);
    expect(display.formatAggregatedConsumption(10_000_000)).toBe(
      formatNumber(10_000, 3),
    );
  });

  it("bleibt bei kWh, wenn kein HKV vorliegt (keine Skalierung)", () => {
    const full = period("2024-01-01", "2024-12-31");
    const display = prepareHeatingDisplay(baseDetail(), full, full);
    expect(display.useValuationPoints).toBe(false);
    // Ganzzahlige Einzelwerte -> keine Nachkommastellen.
    expect(display.formatAggregatedConsumption(1800)).toBe(
      formatNumber(1800, 0),
    );
  });

  it("zieht Warmwasser aus dem Anzeige-Heiztopf ab", () => {
    const full = period("2024-01-01", "2024-12-31");
    const detail = baseDetail({
      hotWaterDetail: {
        method: "boiler_meter",
        totalHeatEnergyKwh: 1000,
        hotWaterHeatKwh: 300,
        hotWaterShareBps: 3000,
        hotWaterPotCents: 30_000,
        consumptionShareBps: 6000,
        consumptionPortionCents: 18_000,
        basicPortionCents: 12_000,
        consumptionDistributionMethod: "consumption",
        perUnit: [],
        landlordBasicCostCents: 0,
        landlordConsumptionCostCents: 0,
      },
    });
    const display = prepareHeatingDisplay(detail, full, full);
    expect(display.heatingPotForDisplay).toBe(70_000);
    expect(display.hotWaterConsumptionPct).toBe(60);
    expect(display.hotWaterBasicPct).toBe(40);
  });
});

describe("perMeterDisplayDigits", () => {
  it("unterdrückt Nachkommastellen bei durchweg ganzzahligen Spalten", () => {
    expect(
      perMeterDisplayDigits([
        {
          meterId: "m1",
          meterLabel: "Z",
          serialNumber: null,
          unitId: "a",
          unitName: null,
          consumptionRaw: 100,
          kTotal: 2,
          consumptionWeighted: 200,
        },
      ]),
    ).toEqual({
      consumptionRawDigits: 0,
      kTotalDigits: 0,
      consumptionWeightedDigits: 0,
    });
  });

  it("zeigt volle Genauigkeit bei Nachkommawerten", () => {
    expect(
      perMeterDisplayDigits([
        {
          meterId: "m1",
          meterLabel: "Z",
          serialNumber: null,
          unitId: "a",
          unitName: null,
          consumptionRaw: 100.5,
          kTotal: 2.25,
          consumptionWeighted: 200.5,
        },
      ]),
    ).toEqual({
      consumptionRawDigits: 2,
      kTotalDigits: 3,
      consumptionWeightedDigits: 2,
    });
  });
});

describe("co2TierLabel", () => {
  it("wählt die unterste Stufe (nur Obergrenze)", () => {
    expect(co2TierLabel(5)).toEqual({
      key: "statements.pdf.heating.co2.tierBelow",
      params: { max: formatNumber(12, 0) },
    });
  });

  it("wählt eine mittlere Stufe (Bereich)", () => {
    expect(co2TierLabel(20)).toEqual({
      key: "statements.pdf.heating.co2.tierRange",
      params: { min: formatNumber(17, 0), max: formatNumber(22, 0) },
    });
  });

  it("wählt die oberste Stufe (nur Untergrenze)", () => {
    expect(co2TierLabel(60)).toEqual({
      key: "statements.pdf.heating.co2.tierAbove",
      params: { min: formatNumber(52, 0) },
    });
  });
});

describe("co2TenantShareCents (§ 7 Abs. 3 CO2KostAufG)", () => {
  const withCo2 = baseDetail({
    co2Detail: {
      totalCostCents: 20_000,
      totalAmountGrams: 4_000_000,
      emissionsKgPerSqmYear: 25,
      landlordSharePercent: 30,
      landlordDeductionCents: 6000,
      livingAreaSqm: 80,
    },
  });

  it("rechnet den Mieteranteil aus seinem Anteil am Topf hoch", () => {
    // Mieterseitige CO2-Kosten 20.000 - 6.000 = 14.000 Cent; die Wohnung
    // trägt 55.000 von 100.000 Cent des Topfes -> 7.700 Cents
    expect(co2TenantShareCents(withCo2, 55_000)).toBe(7700);
  });

  it("null ohne CO2-Detail", () => {
    expect(co2TenantShareCents(baseDetail(), 55_000)).toBeNull();
  });

  it("null bei leerem Topf", () => {
    const emptyPot = baseDetail({
      totalHeatingCostsCents: 0,
      co2Detail: withCo2.co2Detail,
    });
    expect(co2TenantShareCents(emptyPot, 0)).toBeNull();
  });
});

describe("hotWaterFactRows", () => {
  const hotWater = {
    method: "estimated" as const,
    totalHeatEnergyKwh: 20_000,
    hotWaterHeatKwh: 5000,
    hotWaterShareBps: 2500,
    hotWaterPotCents: 25_000,
    consumptionShareBps: 7000,
    consumptionPortionCents: 17_500,
    basicPortionCents: 7500,
    consumptionDistributionMethod: "consumption" as const,
    perUnit: [],
    landlordBasicCostCents: 0,
    landlordConsumptionCostCents: 0,
  };

  it("weist Ermittlungsweg, Q_gesamt und Q_WW aus", () => {
    const keys = hotWaterFactRows(hotWater).map((row) => row.key);
    expect(keys).toEqual(["method", "totalHeatEnergy", "hotWaterHeat"]);
  });

  it("nennt den Korrekturfaktor nur, wenn einer greift", () => {
    const withFactor = hotWaterFactRows({
      ...hotWater,
      correctionFactor: 1.11,
    });
    expect(withFactor.map((row) => row.key)).toContain("correctionFactor");
    expect(withFactor.at(-1)?.value.params?.value).toBe("1,11");
  });
});

describe("hasHeatingBreakdown", () => {
  const full = period("2025-01-01", "2025-12-31");
  const partial = period("2025-07-01", "2025-12-31");
  const externalFlat = {
    mode: "external" as const,
    basicPortionCents: 0,
    consumptionPortionCents: 0,
  };

  it("druckt den Rechenweg bei interner Abrechnung immer", () => {
    expect(
      hasHeatingBreakdown(baseDetail({ mode: "internal" }), full, full),
    ).toBe(true);
  });

  it("behandelt Alt-Snapshots ohne Modus wie intern", () => {
    expect(hasHeatingBreakdown(baseDetail(), full, full)).toBe(true);
  });

  it("extern ohne Kürzung und ohne Split: kein Rechenweg", () => {
    expect(hasHeatingBreakdown(externalFlat, full, full)).toBe(false);
  });

  it("extern mit Teilperiode: Rechenweg wegen zeitanteiliger Kürzung", () => {
    expect(hasHeatingBreakdown(externalFlat, partial, full)).toBe(true);
  });

  it("extern mit erfasstem Grund-/Verbrauchs-Split: Rechenweg", () => {
    expect(
      hasHeatingBreakdown(
        { ...externalFlat, basicPortionCents: 30_000 },
        full,
        full,
      ),
    ).toBe(true);
  });
});

describe("billingInfoRows", () => {
  it("liefert ohne Energieträger keine Zeilen (externer Modus)", () => {
    expect(billingInfoRows({})).toEqual([]);
  });

  it("weist Energieträger und 100-%-Anteil aus", () => {
    const rows = billingInfoRows({ fuelType: "gas" });
    expect(rows.map((row) => row.key)).toEqual(["energySource", "energyShare"]);
    expect(rows[0]?.value.key).toBe("ui.heating.fuelTypes.gas");
  });

  it("ergänzt bei Fernwärme Emissionen und Primärenergiefaktor", () => {
    const rows = billingInfoRows({
      fuelType: "district_heat",
      districtHeatInfo: {
        emissionsKgPerYear: 12_500,
        primaryEnergyFactor: 0.28,
      },
    });
    expect(rows.map((row) => row.key)).toEqual([
      "energySource",
      "energyShare",
      "districtHeatEmissions",
      "districtHeatFactor",
    ]);
    expect(rows[2]?.value.params?.value).toBe("12.500");
    expect(rows[3]?.value.params?.value).toBe("0,28");
  });

  it("zeigt nicht erfasste Fernwärme-Werte als Leer-Platzhalter", () => {
    const rows = billingInfoRows({
      fuelType: "district_heat",
      districtHeatInfo: { emissionsKgPerYear: null, primaryEnergyFactor: null },
    });
    expect(rows[2]?.value.key).toBe("ui.common.emptyValue");
    expect(rows[3]?.value.key).toBe("ui.common.emptyValue");
  });
});

describe("billingInfoCostRows", () => {
  it("liefert ohne erfasste Werte keine Zeilen", () => {
    expect(billingInfoCostRows({})).toEqual([]);
  });

  it("weist erfasste Steuern/Abgaben und Erfassungsentgelte als Euro-Beträge aus", () => {
    const rows = billingInfoCostRows({
      containedTaxesCents: 71_400,
      meteringServiceCostCents: 19_000,
    });
    expect(rows.map((row) => row.key)).toEqual([
      "containedTaxes",
      "meteringService",
    ]);
    expect(rows[0]?.value.params?.value).toBe("714,00 €");
    expect(rows[1]?.value.params?.value).toBe("190,00 €");
  });

  it("zeigt jede der beiden Zeilen auch einzeln", () => {
    const rows = billingInfoCostRows({ meteringServiceCostCents: 5000 });
    expect(rows.map((row) => row.key)).toEqual(["meteringService"]);
  });
});

describe("prorationNote", () => {
  /**
   * Statt echter Übersetzungen den Key mit Parametern zurückgeben, damit der
   * Test die Auswahl der Vorlage prüft und nicht den deutschen Text
   */
  const echo = (key: string, params?: Record<string, unknown>): string =>
    params ? `${key}|${JSON.stringify(params)}` : key;
  const tenantPeriod = period("2025-01-01", "2025-03-31");

  it("linear: nur Grundkosten, wenn der Verbrauch gemessen ist", () => {
    const note = prorationNote(
      baseDetail({ prorationMethod: "linear" }),
      tenantPeriod,
      echo,
    );
    expect(note).toBe("statements.pdf.heating.prorationNoteLinearBase");
  });

  it("linear: gesamte Heizkosten im Flächen-Fallback", () => {
    const note = prorationNote(
      baseDetail({
        prorationMethod: "linear",
        consumptionDistributionMethod: "heating_area",
      }),
      tenantPeriod,
      echo,
    );
    expect(note).toBe("statements.pdf.heating.prorationNoteLinearAll");
  });

  it("degree_days: listet die bewohnten Monate mit ihrer Gradtagszahlen-Promille", () => {
    const note = prorationNote(
      baseDetail({ prorationMethod: "degree_days" }),
      tenantPeriod,
      echo,
    );
    expect(note).toContain(
      "statements.pdf.heating.prorationNoteDegreeDaysBase",
    );
    // Jan 170 ‰, Feb 150 ‰, Mär 130 ‰ - die Monatsnamen kommen aus i18n,
    // hier also die Keys.
    expect(note).toContain("common.monthsShort.jan\u00A0170");
    expect(note).toContain("common.monthsShort.mar\u00A0130");
    expect(note).not.toContain("common.monthsShort.apr");
  });
});

describe("consumptionUnitLabel", () => {
  it("kWh bei Wärmemengenzählern", () => {
    expect(consumptionUnitLabel("heat_meter", false).key).toBe(
      "statements.pdf.heating.consumptionKwh",
    );
  });

  it("Anzeigewerte bzw. Bewertungspunkte bei Heizkostenverteilern", () => {
    expect(consumptionUnitLabel("heat_cost_allocator", false).key).toBe(
      "statements.pdf.heating.consumptionUnitsRaw",
    );
    expect(consumptionUnitLabel("heat_cost_allocator", true).key).toBe(
      "statements.pdf.heating.consumptionUnits",
    );
  });
});
