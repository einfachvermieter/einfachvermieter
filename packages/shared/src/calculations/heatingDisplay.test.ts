import { describe, expect, it } from "vitest";
import { formatNumber } from "../format.js";
import type { EnergyComparison, HeatingDetail } from "../types/index.js";
import {
  averageUserComparison,
  billingInfoCostRows,
  billingInfoRows,
  co2TenantShareCents,
  co2TierLabel,
  consumptionUnitLabel,
  energyComparisonDisplay,
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

  it("erklärt nicht erfasste Fernwärme-Werte mit einem Satz statt Leer-Platzhalter", () => {
    const rows = billingInfoRows({
      fuelType: "district_heat",
      districtHeatInfo: { emissionsKgPerYear: null, primaryEnergyFactor: null },
    });
    expect(rows[2]?.value.key).toBe(
      "statements.pdf.billingInfo.districtHeatValueMissing",
    );
    expect(rows[3]?.value.key).toBe(
      "statements.pdf.billingInfo.districtHeatValueMissing",
    );
  });
});

describe("billingInfoCostRows", () => {
  const lastSegment = (key: string): string => key.split(".").at(-1) ?? key;

  it("liefert ohne erfasste Werte keine Zeilen", () => {
    expect(billingInfoCostRows({}, lastSegment)).toEqual([]);
  });

  it("weist erfasste Steuern/Abgaben und Erfassungsentgelte als Euro-Beträge aus", () => {
    const rows = billingInfoCostRows(
      {
        containedTaxesCents: 71_400,
        meteringServiceCostCents: 19_000,
      },
      lastSegment,
    );
    expect(rows.map((row) => row.key)).toEqual([
      "containedTaxes",
      "meteringService",
    ]);
    expect(rows[0]?.value.params?.value).toBe("714,00 €");
    expect(rows[1]?.value.params?.value).toBe("190,00 €");
  });

  it("nennt die erfassten Arten im Label der Steuerzeile", () => {
    const rows = billingInfoCostRows(
      {
        containedTaxesCents: 71_400,
        containedTaxKinds: ["value_added_tax", "co2_price"],
      },
      lastSegment,
    );
    expect(rows.map((row) => row.key)).toEqual(["containedTaxes"]);
    expect(rows[0]?.label.key).toBe(
      "statements.pdf.billingInfo.containedTaxesLabelWithKinds",
    );
    expect(rows[0]?.label.params?.kinds).toBe("value_added_tax, co2_price");
  });

  it("zeigt jede der beiden Zeilen auch einzeln", () => {
    const rows = billingInfoCostRows(
      { meteringServiceCostCents: 5000 },
      lastSegment,
    );
    expect(rows.map((row) => row.key)).toEqual(["meteringService"]);
  });
});

describe("averageUserComparison (§ 6a Abs. 3 Nr. 4 HeizkostenV)", () => {
  const fullPeriod = period("2025-01-01", "2025-12-31");

  it("stellt eigenen Verbrauch je m² dem Gebäudedurchschnitt gegenüber", () => {
    const result = averageUserComparison(
      baseDetail(),
      "a",
      fullPeriod,
      fullPeriod,
    );
    expect(result?.rows.map((row) => row.key)).toEqual([
      "ownConsumption",
      "averageConsumption",
    ]);
    // 1000 kWh / 50 m2 = 20,0; (1000 + 800) / (50 + 30) = 22,5
    expect(result?.rows[0]?.value.params?.value).toBe("20,0");
    expect(result?.rows[1]?.value.params?.value).toBe("22,5");
    // Der Schnitt nennt, ueber wie viele Wohnungen er geht.
    expect(result?.rows[1]?.label.params?.count).toBe("2");
    expect(result?.rows[0]?.value.key).toBe(
      "statements.pdf.billingInfo.comparisonValueKwh",
    );
  });

  it("nutzt bei Heizkostenverteilern Verbrauchseinheiten je m²", () => {
    const result = averageUserComparison(
      baseDetail({ consumptionMethod: "heat_cost_allocator" }),
      "a",
      fullPeriod,
      fullPeriod,
    );
    expect(result?.rows[0]?.value.key).toBe(
      "statements.pdf.billingInfo.comparisonValueUnits",
    );
  });

  it("skaliert oberhalb der Bewertungspunkte-Schwelle auf Punkte je m²", () => {
    const detail = baseDetail({ consumptionMethod: "heat_cost_allocator" });
    detail.perUnit = detail.perUnit.map((row, idx) => ({
      ...row,
      consumptionKwh: idx === 0 ? 8_000_000 : 4_000_000,
    }));
    const result = averageUserComparison(detail, "a", fullPeriod, fullPeriod);
    expect(result?.rows[0]?.value.key).toBe(
      "statements.pdf.billingInfo.comparisonValuePoints",
    );
    // 8.000.000 / 50 m² / 1000 = 160,0
    expect(result?.rows[0]?.value.params?.value).toBe("160,0");
  });

  it("rechnet bei unterjähriger Nutzung über die Gradtagszahlen hoch", () => {
    const result = averageUserComparison(
      baseDetail(),
      "a",
      period("2025-01-01", "2025-06-30"),
      fullPeriod,
    );
    // Jan-Jun = 583 ‰ -> 1000 kWh / 583 × 1000 = 1715,3 kWh; / 50 m² = 34,3
    expect(result?.isExtrapolated).toBe(true);
    expect(result?.rows[0]?.value.params?.value).toBe("34,3");
    // Durchschnitt mit dem hochgerechneten Wert: (1715,3 + 800) / 80 m²
    expect(result?.rows[1]?.value.params?.value).toBe("31,4");
  });

  it("entfällt in einem Gebäude mit nur einer Wohnung", () => {
    const detail = baseDetail();
    detail.perUnit = detail.perUnit.slice(0, 1);
    expect(
      averageUserComparison(detail, "a", fullPeriod, fullPeriod),
    ).toBeNull();
  });

  it("entfällt im externen Modus und im Flächen-Fallback", () => {
    expect(
      averageUserComparison(
        baseDetail({ mode: "external" }),
        "a",
        fullPeriod,
        fullPeriod,
      ),
    ).toBeNull();
    expect(
      averageUserComparison(
        baseDetail({ consumptionDistributionMethod: "heating_area" }),
        "a",
        fullPeriod,
        fullPeriod,
      ),
    ).toBeNull();
  });

  it("entfällt ohne eigene Wohnungszeile", () => {
    expect(
      averageUserComparison(baseDetail(), "unbekannt", fullPeriod, fullPeriod),
    ).toBeNull();
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

describe("energyComparisonDisplay (§ 6a Abs. 3 Nr. 5 HeizkostenV)", () => {
  const comparison = (
    overrides: Partial<EnergyComparison> = {},
  ): EnergyComparison => ({
    consumptionUnit: "kwh",
    includesHotWater: false,
    current: {
      period: period("2025-01-01", "2025-12-31"),
      normalizedConsumption: 1200,
    },
    previous: {
      period: period("2024-01-01", "2024-12-31"),
      normalizedConsumption: 1500,
    },
    ...overrides,
  });

  it("zeigt ohne Vorperiode die Hinweiszeile statt Balken", () => {
    const display = energyComparisonDisplay(
      comparison({ previous: undefined }),
    );
    expect(display.previousMissing).toBe(true);
    expect(display.bars).toEqual([]);
  });

  it("skaliert die Balken relativ zum größeren Wert", () => {
    const display = energyComparisonDisplay(comparison());
    expect(display.bars.map((bar) => bar.key)).toEqual(["current", "previous"]);
    expect(display.bars[0]?.widthPct).toBe(80);
    expect(display.bars[1]?.widthPct).toBe(100);
    expect(display.bars[0]?.value).toEqual({
      key: "statements.pdf.billingInfo.comparisonPrevValueKwh",
      params: { value: "1.200" },
    });
    expect(display.bars[0]?.label.params).toEqual({
      start: "01.01.2025",
      end: "31.12.2025",
    });
    // Ohne Klimafaktoren sagt die Fußnote ehrlich "nicht witterungsbereinigt".
    expect(display.notes.map((note) => note.key)).toEqual([
      "statements.pdf.billingInfo.comparisonPrevNoAdjustmentNote",
    ]);
  });

  it("nennt die Quelle im Witterungs-Satz, die Faktoren im Rechenweg", () => {
    const display = energyComparisonDisplay(
      comparison({
        current: {
          period: period("2025-01-01", "2025-12-31"),
          normalizedConsumption: 1280,
          climateFactor: 1.28,
        },
        previous: {
          period: period("2024-01-01", "2024-12-31"),
          normalizedConsumption: 2025,
          climateFactor: 1.35,
        },
      }),
    );
    // Die Faktoren stehen im Rechenweg darunter, nicht doppelt im Satz.
    expect(display.notes[0]).toEqual({
      key: "statements.pdf.billingInfo.comparisonPrevWeatherNoteShort",
    });
  });

  it("lässt den DWD-Vermerk weg, sobald ein Faktor manuell erfasst ist", () => {
    const display = energyComparisonDisplay(
      comparison({
        current: {
          period: period("2025-01-01", "2025-12-31"),
          normalizedConsumption: 1280,
          climateFactor: 1.28,
          climateFactorIsManual: true,
        },
        previous: {
          period: period("2024-01-01", "2024-12-31"),
          normalizedConsumption: 2025,
          climateFactor: 1.35,
        },
      }),
    );
    expect(display.notes[0]?.key).toBe(
      "statements.pdf.billingInfo.comparisonPrevWeatherNoteShortManual",
    );
  });

  it("legt den Rechenweg beider Seiten offen", () => {
    const display = energyComparisonDisplay(
      comparison({
        current: {
          period: period("2025-01-01", "2025-12-31"),
          normalizedConsumption: 1280,
          climateFactor: 1.28,
        },
        previous: {
          period: period("2024-01-01", "2024-12-31"),
          normalizedConsumption: 1350,
          climateFactor: 1.35,
        },
      }),
    );
    const calculation = display.notes.find(
      (note) =>
        note.key === "statements.pdf.billingInfo.comparisonPrevCalculationNote",
    );
    // 1.280 / 1,28 = 1.000 bzw. 1.350 / 1,35 = 1.000
    expect(calculation?.params).toEqual({
      currentBase: "1.000",
      currentFactor: "1,28",
      currentResult: "1.280",
      previousBase: "1.000",
      previousFactor: "1,35",
      previousResult: "1.350",
    });
  });

  it("behält die Faktoren im Satz, wenn kein Rechenweg folgt (Warmwasser)", () => {
    const display = energyComparisonDisplay(
      comparison({
        includesHotWater: true,
        current: {
          period: period("2025-01-01", "2025-12-31"),
          normalizedConsumption: 1280,
          climateFactor: 1.28,
        },
        previous: {
          period: period("2024-01-01", "2024-12-31"),
          normalizedConsumption: 1350,
          climateFactor: 1.35,
        },
      }),
    );
    expect(display.notes[0]).toEqual({
      key: "statements.pdf.billingInfo.comparisonPrevWeatherNote",
      params: { current: "1,28", previous: "1,35" },
    });
  });

  it("weist hochgerechnete Zeiträume in der Fußnote aus", () => {
    const withPartial = energyComparisonDisplay(
      comparison({
        current: {
          period: period("2025-07-01", "2025-12-31"),
          normalizedConsumption: 1200,
        },
      }),
    );
    expect(
      withPartial.notes.some(
        (note) =>
          note.key ===
          "statements.pdf.billingInfo.comparisonPrevExtrapolatedNote",
      ),
    ).toBe(true);
    // Die Balken-Labels bleiben einzeilig, sonst bricht der Anhang um.
    expect(withPartial.bars[0]?.label.key).toBe(
      "statements.pdf.billingInfo.comparisonPrevCurrentLabel",
    );

    // Zwei volle Kalenderjahre: kein Hinweis.
    expect(
      energyComparisonDisplay(comparison()).notes.some(
        (note) =>
          note.key ===
          "statements.pdf.billingInfo.comparisonPrevExtrapolatedNote",
      ),
    ).toBe(false);
  });

  it("lässt den Rechenweg weg, wenn Warmwasser enthalten ist", () => {
    const display = energyComparisonDisplay(
      comparison({
        includesHotWater: true,
        current: {
          period: period("2025-01-01", "2025-12-31"),
          normalizedConsumption: 1280,
          climateFactor: 1.28,
        },
        previous: {
          period: period("2024-01-01", "2024-12-31"),
          normalizedConsumption: 1350,
          climateFactor: 1.35,
        },
      }),
    );
    expect(
      display.notes.some(
        (note) =>
          note.key ===
          "statements.pdf.billingInfo.comparisonPrevCalculationNote",
      ),
    ).toBe(false);
  });

  it("ergänzt die Warmwasser-Erläuterung, wenn Warmwasser enthalten ist", () => {
    const display = energyComparisonDisplay(
      comparison({ includesHotWater: true }),
    );
    expect(display.notes.map((note) => note.key)).toEqual([
      "statements.pdf.billingInfo.comparisonPrevNoAdjustmentNote",
      "statements.pdf.billingInfo.comparisonPrevHotWaterNote",
    ]);
  });

  it("wechselt oberhalb der Schwelle einheitlich auf Bewertungspunkte", () => {
    const display = energyComparisonDisplay(
      comparison({
        consumptionUnit: "hkv_units",
        current: {
          period: period("2025-01-01", "2025-12-31"),
          normalizedConsumption: 8_000_000,
        },
        previous: {
          period: period("2024-01-01", "2024-12-31"),
          normalizedConsumption: 12_000_000,
        },
      }),
    );
    expect(display.bars[0]?.value).toEqual({
      key: "statements.pdf.billingInfo.comparisonPrevValuePoints",
      params: { value: "8.000" },
    });
    expect(display.bars[1]?.value.params?.value).toBe("12.000");
  });
});
