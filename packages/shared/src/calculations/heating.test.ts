import { describe, expect, it } from "vitest";
import type { MeterInfo, ReadingPoint, UnitInfo } from "../types/index.js";
import {
  aggregateHeatingCosts,
  calculateCo2Split,
  calculateExternalHeating,
  calculateHeating,
  co2LandlordSharePercent,
  co2Tier,
} from "./heating.js";

const unitEg: UnitInfo = {
  id: "unit-eg",
  name: "EG",
  areaSqm: 80,
  occupantCount: 1,
  personDays: 365,
  occupiedDays: 365,
  periodDays: 365,
};

const unitOg: UnitInfo = {
  id: "unit-og",
  name: "OG/DG",
  areaSqm: 120,
  occupantCount: 2,
  personDays: 730,
  occupiedDays: 365,
  periodDays: 365,
};

const heatMeter = (id: string, unitId: string): MeterInfo => ({
  id,
  type: "heat_meter",
  role: "unit",
  unitId,
  label: `Wärmemengenzähler ${id}`,
  measurementUnit: "kwh",
  validFrom: "1900-01-01",
  validUntil: null,
});

const reading = (date: string, value: number): ReadingPoint => ({
  date,
  value,
  isCumulative: true,
  isEstimated: false,
});

describe("calculateHeating", () => {
  it("verteilt 70/30 korrekt bei Wärmemengenzählern", () => {
    // 10000 Cent Heizkosten, 70 % Verbrauch = 7000, 30 % Grund = 3000
    // Verbrauch: EG 100 kWh, OG 300 kWh (25 %/75 %)
    // Fläche: EG 80 qm / OG 120 qm = 40 %/60 %
    //
    // EG: Verbrauch 7000 x 0,25 = 1750, Grund 3000 x 0,40 = 1200 = 2950
    // OG: Verbrauch 7000 x 0,75 = 5250, Grund 3000 x 0,60 = 1800 = 7050
    const result = calculateHeating({
      totalHeatingCostsCents: 10_000,
      config: { consumptionShareBps: 7000 },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_meter",
      consumptionMeters: [
        {
          meter: heatMeter("wmz-eg", "unit-eg"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
        },
        {
          meter: heatMeter("wmz-og", "unit-og"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 300)],
        },
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    expect(result.consumptionPortionCents).toBe(7000);
    expect(result.basicPortionCents).toBe(3000);

    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    const og = result.perUnit.find((u) => u.unitId === "unit-og");

    expect(eg?.consumptionCostCents).toBe(1750);
    expect(eg?.basicCostCents).toBe(1200);
    expect(eg?.totalCents).toBe(2950);

    expect(og?.consumptionCostCents).toBe(5250);
    expect(og?.basicCostCents).toBe(1800);
    expect(og?.totalCents).toBe(7050);

    expect((eg?.totalCents ?? 0) + (og?.totalCents ?? 0)).toBe(10_000);
  });

  it("funktioniert bei 50/50-Verteilung", () => {
    const result = calculateHeating({
      totalHeatingCostsCents: 10_000,
      config: { consumptionShareBps: 5000 },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_meter",
      consumptionMeters: [
        {
          meter: heatMeter("wmz-eg", "unit-eg"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
        },
        {
          meter: heatMeter("wmz-og", "unit-og"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
        },
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    expect(result.consumptionPortionCents).toBe(5000);
    expect(result.basicPortionCents).toBe(5000);
  });

  it("wirft bei Wärmemengenzähler ohne Unit-Zuordnung", () => {
    const meter: MeterInfo = {
      id: "broken",
      type: "heat_meter",
      role: "main",
      unitId: null,
      label: "broken",
      measurementUnit: "kwh",
      validFrom: "1900-01-01",
      validUntil: null,
    };

    expect(() =>
      calculateHeating({
        totalHeatingCostsCents: 10_000,
        config: { consumptionShareBps: 7000 },
        units: [unitEg, unitOg],
        consumptionMethod: "heat_meter",
        consumptionMeters: [
          {
            meter,
            readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
          },
        ],
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      }),
    ).toThrow(/heatingMeterNoUnit/u);
  });

  it("Summe der Einzelbeträge = Gesamtkosten (keine Cent verloren)", () => {
    const result = calculateHeating({
      totalHeatingCostsCents: 123_457,
      config: { consumptionShareBps: 7000 },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_meter",
      consumptionMeters: [
        {
          meter: heatMeter("wmz-eg", "unit-eg"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 73)],
        },
        {
          meter: heatMeter("wmz-og", "unit-og"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 241)],
        },
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    const sum = result.perUnit.reduce((acc, u) => acc + u.totalCents, 0);
    expect(sum).toBe(123_457);
  });

  it("HKV: bewertet Anzeigewerte x KGesamt und summiert pro Wohnung", () => {
    // 10000 Cent Heizkosten, 70/30 - wie der WMZ-Fall.
    // EG: 1 HKV (Wohnzimmer), 100 Anzeigewerte x kTotal 1.0 = 100
    // OG: 2 HKV (Wohnzimmer 200 x 1.0 = 200, Bad 50 x 2.0 = 100) -> Summe 300
    // Verbrauchsverteilung EG/OG = 25 % / 75 %.
    const hkv = (id: string, unitId: string, kTotal: number): MeterInfo => ({
      id,
      type: "heat_cost_allocator",
      role: "unit",
      unitId,
      label: `HKV ${id}`,
      measurementUnit: "units",
      kTotal,
      validFrom: "1900-01-01",
      validUntil: null,
    });

    const result = calculateHeating({
      totalHeatingCostsCents: 10_000,
      config: { consumptionShareBps: 7000 },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_cost_allocator",
      consumptionMeters: [
        {
          meter: hkv("hkv-eg-wz", "unit-eg", 1.0),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
        },
        {
          meter: hkv("hkv-og-wz", "unit-og", 1.0),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 200)],
        },
        {
          meter: hkv("hkv-og-bad", "unit-og", 2.0),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 50)],
        },
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    expect(result.consumptionMethod).toBe("heat_cost_allocator");
    expect(result.consumptionPortionCents).toBe(7000);
    expect(result.basicPortionCents).toBe(3000);

    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    const og = result.perUnit.find((u) => u.unitId === "unit-og");

    expect(eg?.consumptionKwh).toBe(100); // bewertete Einheiten
    expect(og?.consumptionKwh).toBe(300);

    expect(eg?.consumptionCostCents).toBe(1750);
    expect(og?.consumptionCostCents).toBe(5250);
    expect(eg?.basicCostCents).toBe(1200);
    expect(og?.basicCostCents).toBe(1800);
    expect((eg?.totalCents ?? 0) + (og?.totalCents ?? 0)).toBe(10_000);
  });

  it("HKV: wirft bei fehlendem KGesamt", () => {
    const broken: MeterInfo = {
      id: "hkv-broken",
      type: "heat_cost_allocator",
      role: "unit",
      unitId: "unit-eg",
      label: "HKV ohne kTotal",
      measurementUnit: "units",
      kTotal: null,
      validFrom: "1900-01-01",
      validUntil: null,
    };

    expect(() =>
      calculateHeating({
        totalHeatingCostsCents: 10_000,
        config: { consumptionShareBps: 7000 },
        units: [unitEg, unitOg],
        consumptionMethod: "heat_cost_allocator",
        consumptionMeters: [
          {
            meter: broken,
            readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
          },
        ],
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      }),
    ).toThrow(/heatingAllocatorNoKTotal/u);
  });

  it("Fallback: ohne Verbrauchsmesser wird Verbrauchsanteil nach Heizfläche verteilt", () => {
    // 10000 Cent Heizkosten, 70 % Verbrauch = 7000, 30 % Grund = 3000.
    // Keine WMZ -> Verbrauchsanteil fällt auf Heizfläche zurück. Beide
    // Anteile werden 40/60 verteilt, Gesamtsumme bleibt erhalten.
    const result = calculateHeating({
      totalHeatingCostsCents: 10_000,
      config: { consumptionShareBps: 7000 },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_meter",
      consumptionMeters: [],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    expect(result.consumptionDistributionMethod).toBe("heating_area");
    expect(result.warnings?.length ?? 0).toBeGreaterThan(0);

    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    const og = result.perUnit.find((u) => u.unitId === "unit-og");
    // EG: 4000 (Verbrauch 7000x0,4) + 1200 (Grund 3000x0,4) - eigentlich
    // 2800 + 1200, distributeCents kann Restverteilung leicht verschieben.
    expect(eg?.consumptionCostCents).toBe(2800);
    expect(eg?.basicCostCents).toBe(1200);
    expect(og?.consumptionCostCents).toBe(4200);
    expect(og?.basicCostCents).toBe(1800);
    expect((eg?.totalCents ?? 0) + (og?.totalCents ?? 0)).toBe(10_000);
  });

  it("perMeter-Aufschlüsselung enthält rohe und bewertete Werte (HKV)", () => {
    const hkv = (id: string, unitId: string, kTotal: number): MeterInfo => ({
      id,
      type: "heat_cost_allocator",
      role: "unit",
      unitId,
      label: `HKV ${id}`,
      measurementUnit: "units",
      kTotal,
      validFrom: "1900-01-01",
      validUntil: null,
    });

    const result = calculateHeating({
      totalHeatingCostsCents: 10_000,
      config: { consumptionShareBps: 7000 },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_cost_allocator",
      consumptionMeters: [
        {
          meter: hkv("hkv-eg-wz", "unit-eg", 1.5),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 80)],
        },
        {
          meter: hkv("hkv-og-bad", "unit-og", 2.0),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 50)],
        },
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    expect(result.perMeter).toHaveLength(2);
    const egMeter = result.perMeter?.find((m) => m.meterId === "hkv-eg-wz");
    expect(egMeter?.consumptionRaw).toBe(80);
    expect(egMeter?.kTotal).toBe(1.5);
    expect(egMeter?.consumptionWeighted).toBe(120);
    expect(egMeter?.unitName).toBe("EG");
  });

  it("wirft bei Type-Mismatch zwischen consumptionMethod und Zähler", () => {
    expect(() =>
      calculateHeating({
        totalHeatingCostsCents: 10_000,
        config: { consumptionShareBps: 7000 },
        units: [unitEg],
        consumptionMethod: "heat_cost_allocator",
        consumptionMeters: [
          {
            meter: heatMeter("wmz-eg", "unit-eg"),
            readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
          },
        ],
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      }),
    ).toThrow(/expected heat_cost_allocator/u);
  });

  it("Winter-Mietzeit + degree_days: Verbrauchsanteil bleibt ungekürzt", () => {
    // Setup: Mieter wohnt nur Jan-Mär in der Ziel-Wohnung (EG, 80 qm).
    // OG/DG ist ganzjährig voll belegt. Beide Wohnungen liefern HKV/WMZ-
    // Werte. Wir nehmen den vollen Jahres-Topf (10.000 €), 70/30. Bei
    // korrekter Logik darf der Verbrauchstopf NICHT zusätzlich durch den
    // Gradtag-Anteil der Mietzeit (450 ‰) gekürzt werden - die Mietzeit-
    // Zuordnung des Verbrauchs ergibt sich allein aus den Zähler-Delta. Die
    // 30 % Grundkosten dürfen via degree_days gewichtet werden.
    const winterTenant: UnitInfo = {
      ...unitEg,
      occupiedDays: 90, // Jan-Mär ~= 90 Tage
      occupiedDegreeDayPromille: 450, // 170+150+130
      periodDays: 365,
      periodDegreeDayPromille: 1000,
    };
    const fullYearOther: UnitInfo = {
      ...unitOg,
      occupiedDays: 365,
      occupiedDegreeDayPromille: 1000,
      periodDays: 365,
      periodDegreeDayPromille: 1000,
    };
    const result = calculateHeating({
      totalHeatingCostsCents: 1_000_000, // 10.000 € - Jahres-Topf, ungekürzt
      config: { consumptionShareBps: 7000 },
      units: [winterTenant, fullYearOther],
      consumptionMethod: "heat_meter",
      consumptionMeters: [
        {
          meter: heatMeter("wmz-eg", "unit-eg"),
          // Mietzeit Delta = 600 kWh (Jan-Mär, Winter-Heizphase)
          readings: [reading("2025-01-01", 0), reading("2025-03-31", 600)],
        },
        {
          meter: heatMeter("wmz-og", "unit-og"),
          // Ganzjährig Delta = 1.000 kWh
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 1000)],
        },
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      tenantPeriodStart: "2025-01-01",
      tenantPeriodEnd: "2025-03-31",
      targetUnitId: "unit-eg",
      prorationMethod: "degree_days",
    });
    // Verbrauchstopf = 70 % x 10.000 € = 7.000 €
    // Summe Verbräuche = 600 + 1.000 = 1.600 kWh
    // EG bekommt 600/1.600 x 7.000 € = 2.625 € - keine zusätzliche 450‰-Kürzung
    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    expect(eg?.consumptionCostCents).toBeGreaterThan(260_000);
    expect(eg?.consumptionCostCents).toBeLessThan(265_000);
    // Grundkostentopf = 30 % x 10.000 € = 3.000 €
    // Gewichte: EG = 80 x 450 = 36.000; OG = 120 x 1.000 = 120.000.
    // Apr-Dez stand EG leer -> Vermieter-Gewicht = 200x1.000 − 156.000 =
    // 44.000. Summe inklusive Vermieter = 200.000.
    // EG bekommt 36.000 / 200.000 x 3.000 € = 540 €.
    expect(eg?.basicCostCents).toBeGreaterThan(53_000);
    expect(eg?.basicCostCents).toBeLessThan(55_000);
    // Leerstand des EG-Vermieters muss als landlordBasicCostCents
    // erscheinen, nicht stillschweigend auf andere umgelegt werden.
    expect(result.landlordBasicCostCents ?? 0).toBeGreaterThan(60_000);
  });

  it("degree_days gewichtet die Verbrauchsschätzung ohne Zwischenablesung", () => {
    // EG-Mieter zieht zum 30.06. aus, es gibt KEINE Zwischenablesung - der
    // EG-Zähler hat nur Stände am 01.01. und 31.12. Der Verbrauch der Mietzeit
    // muss geschätzt werden. Linear ~= halbes Jahr; degree_days gewichtet nach
    // HKVO-Gradtagen (§ 9b HeizkostenV) -> der Winter-Mieter trägt mehr.
    const baseInput = {
      totalHeatingCostsCents: 1_000_000,
      config: { consumptionShareBps: 7000 },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_meter" as const,
      consumptionMeters: [
        {
          meter: heatMeter("wmz-eg", "unit-eg"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 1200)],
        },
        {
          meter: heatMeter("wmz-og", "unit-og"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 1000)],
        },
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      tenantPeriodStart: "2025-01-01",
      tenantPeriodEnd: "2025-06-30",
      targetUnitId: "unit-eg",
    };
    const linear = calculateHeating({
      ...baseInput,
      prorationMethod: "linear",
    });
    const degreeDays = calculateHeating({
      ...baseInput,
      prorationMethod: "degree_days",
    });
    const egLinear = linear.perUnit.find((u) => u.unitId === "unit-eg");
    const egDegree = degreeDays.perUnit.find((u) => u.unitId === "unit-eg");
    // Nenner = volle Periode: EG 1.200 + OG 1.000 = 2.200 kWh; der Verbrauch
    // nach dem Auszug (~600 kWh) fällt als Vermieteranteil an.
    // Linear: Delta ~= 1200 x 180/364 ~= 593 kWh -> 593/2200 x 7.000 € ~= 1.888 €.
    expect(egLinear?.consumptionCostCents).toBeGreaterThan(186_000);
    expect(egLinear?.consumptionCostCents).toBeLessThan(191_000);
    // degree_days: Delta ~= 1200 x 0,583 ~= 700 kWh -> 700/2200 x 7.000 € ~= 2.227 €.
    expect(egDegree?.consumptionCostCents).toBeGreaterThan(220_000);
    expect(egDegree?.consumptionCostCents).toBeLessThan(226_000);
    expect(egDegree?.consumptionCostCents ?? 0).toBeGreaterThan(
      egLinear?.consumptionCostCents ?? 0,
    );
    // Der nicht dem Mieter zurechenbare EG-Verbrauch gehört dem Vermieter.
    expect(linear.landlordConsumptionCostCents ?? 0).toBeGreaterThan(185_000);
  });

  it("Mieterwechsel mit Nachmieter: Summen-Invariante über beide Statements", () => {
    // Wohnung X: Mieter A (01.01.-30.06., 181 Tage), Nachmieter B
    // (01.07.-31.12., 184 Tage). Wohnung Y ganzjährig belegt. Beide 100 qm.
    // X verbraucht je 500 kWh pro Halbjahr (Zwischenablesung am Wechsel),
    // Y 1.000 kWh. Topf 10.000 €, 70/30.
    //
    // Verbrauch: Nenner in beiden Statements = 2.000 kWh (X voll + Y voll)
    // -> A und B je 500/2000 x 7.000 € = 1.750 €, Y 3.500 €. Grundkosten:
    // X-Gewicht auf die Mietzeit geclippt, der Rest fällt im jeweiligen
    // Statement dem Vermieter zu und wird über das andere Statement wieder
    // eingesammelt. Vor dem Fix kassierte jedes Statement den vollen
    // X-Jahresanteil (Verbrauch: 500/1500 x 7.000 € = 2.333 €).
    const unitX = (occupiedDays: number): UnitInfo => ({
      id: "unit-x",
      name: "X",
      areaSqm: 100,
      occupantCount: 1,
      personDays: occupiedDays,
      occupiedDays,
      periodDays: 365,
    });
    const unitY: UnitInfo = {
      id: "unit-y",
      name: "Y",
      areaSqm: 100,
      occupantCount: 1,
      personDays: 365,
      occupiedDays: 365,
      periodDays: 365,
    };
    const consumptionMeters = [
      {
        meter: heatMeter("wmz-x", "unit-x"),
        readings: [
          reading("2025-01-01", 0),
          reading("2025-06-30", 500),
          reading("2025-07-01", 500),
          reading("2025-12-31", 1000),
        ],
      },
      {
        meter: heatMeter("wmz-y", "unit-y"),
        readings: [reading("2025-01-01", 0), reading("2025-12-31", 1000)],
      },
    ];
    const baseInput = {
      totalHeatingCostsCents: 1_000_000,
      config: { consumptionShareBps: 7000 },
      consumptionMethod: "heat_meter" as const,
      consumptionMeters,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      targetUnitId: "unit-x",
    };
    const statementA = calculateHeating({
      ...baseInput,
      units: [unitX(181), unitY],
      tenantPeriodStart: "2025-01-01",
      tenantPeriodEnd: "2025-06-30",
    });
    const statementB = calculateHeating({
      ...baseInput,
      units: [unitX(184), unitY],
      tenantPeriodStart: "2025-07-01",
      tenantPeriodEnd: "2025-12-31",
    });

    const xInA = statementA.perUnit.find((u) => u.unitId === "unit-x");
    const xInB = statementB.perUnit.find((u) => u.unitId === "unit-x");
    const yInA = statementA.perUnit.find((u) => u.unitId === "unit-y");

    // Verbrauchsanteile exakt: je 500 von 2.000 kWh.
    expect(xInA?.consumptionCostCents).toBe(175_000);
    expect(xInB?.consumptionCostCents).toBe(175_000);
    expect(yInA?.consumptionCostCents).toBe(350_000);
    // Nachmieter-Verbrauch fällt in Statement A dem Vermieter zu.
    expect(statementA.landlordConsumptionCostCents).toBe(175_000);

    // Jedes Statement verteilt exakt den Topf (Mieter + Vermieter).
    for (const statement of [statementA, statementB]) {
      const distributed =
        statement.perUnit.reduce((acc, u) => acc + u.totalCents, 0) +
        (statement.landlordBasicCostCents ?? 0) +
        (statement.landlordConsumptionCostCents ?? 0);
      expect(distributed).toBe(1_000_000);
    }

    // Summen-Invariante über die Statements: A + B + Y == Topf, die Wohnung
    // wird nicht doppelt kassiert (vorher: X-Anteil in beiden Statements
    // jeweils voll).
    expect(
      (xInA?.totalCents ?? 0) +
        (xInB?.totalCents ?? 0) +
        (yInA?.totalCents ?? 0),
    ).toBe(1_000_000);
  });

  it("Warmwasser: Verbrauch außerhalb der Mietzeit fällt dem Vermieter zu", () => {
    // WW-Topf: Q_WW 250 von 1.000 kWh -> 25 % von 10.000 € = 2.500 €;
    // davon 70 % Verbrauch = 1.750 €. Gewichte: X-Mieter 10 m3, Y 20 m3,
    // Vermieter (Vor-/Nachmieter der Ziel-Wohnung) 10 m3.
    const result = calculateHeating({
      totalHeatingCostsCents: 1_000_000,
      config: { consumptionShareBps: 7000 },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_meter",
      consumptionMeters: [
        {
          meter: heatMeter("wmz-eg", "unit-eg"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
        },
        {
          meter: heatMeter("wmz-og", "unit-og"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
        },
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      hotWater: {
        totalHeatEnergyKwh: 1000,
        boilerHeatKwh: 250,
        hotWaterVolumeM3: 40,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [
          { unitId: "unit-eg", m3: 10 },
          { unitId: "unit-og", m3: 20 },
        ],
        landlordM3: 10,
      },
    });

    const hotWater = result.hotWaterDetail;
    expect(hotWater?.consumptionPortionCents).toBe(175_000);
    const eg = hotWater?.perUnit.find((u) => u.unitId === "unit-eg");
    // 10 von 40 m3 statt 10 von 30 m3 (vorher: 58.333).
    expect(eg?.consumptionCostCents).toBe(43_750);
    expect(hotWater?.landlordConsumptionCostCents).toBe(43_750);
  });
});

describe("calculateExternalHeating", () => {
  it("übernimmt Endbeträge unverändert pro Wohnung", () => {
    const result = calculateExternalHeating({
      units: [unitEg, unitOg],
      entries: [
        {
          unitId: "unit-eg",
          totalCents: 42_000,
          baseCostCents: 12_000,
          consumptionCostCents: 30_000,
        },
        {
          unitId: "unit-og",
          totalCents: 58_000,
          baseCostCents: 18_000,
          consumptionCostCents: 40_000,
        },
      ],
    });

    expect(result.totalHeatingCostsCents).toBe(100_000);
    expect(result.basicPortionCents).toBe(30_000);
    expect(result.consumptionPortionCents).toBe(70_000);
    expect(result.consumptionShareBps).toBe(7000);

    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    expect(eg?.totalCents).toBe(42_000);
    expect(eg?.basicCostCents).toBe(12_000);
    expect(eg?.consumptionCostCents).toBe(30_000);
  });

  it("akzeptiert fehlende Aufteilung (nur Gesamtbetrag)", () => {
    const result = calculateExternalHeating({
      units: [unitEg],
      entries: [
        {
          unitId: "unit-eg",
          totalCents: 50_000,
          baseCostCents: null,
          consumptionCostCents: null,
        },
      ],
    });

    expect(result.totalHeatingCostsCents).toBe(50_000);
    expect(result.basicPortionCents).toBe(0);
    expect(result.consumptionPortionCents).toBe(0);
    expect(result.consumptionShareBps).toBe(0);

    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    expect(eg?.totalCents).toBe(50_000);
  });

  it("summiert mehrere Einträge pro Wohnung", () => {
    const result = calculateExternalHeating({
      units: [unitEg],
      entries: [
        {
          unitId: "unit-eg",
          totalCents: 20_000,
          baseCostCents: 6000,
          consumptionCostCents: 14_000,
        },
        {
          unitId: "unit-eg",
          totalCents: 10_000,
          baseCostCents: 3000,
          consumptionCostCents: 7000,
        },
      ],
    });

    const eg = result.perUnit.find((u) => u.unitId === "unit-eg");
    expect(eg?.totalCents).toBe(30_000);
    expect(eg?.basicCostCents).toBe(9000);
    expect(eg?.consumptionCostCents).toBe(21_000);
  });
});

describe("aggregateHeatingCosts", () => {
  it("liefert 0 für Items komplett außerhalb der Periode", () => {
    const result = aggregateHeatingCosts(
      [
        {
          amountCents: 100_000,
          periodStart: "2024-01-01",
          periodEnd: "2024-12-31",
        },
      ],
      { start: "2025-01-01", end: "2025-12-31" },
      "linear",
    );
    expect(result.totalCents).toBe(0);
    expect(result.perItemAttributedCents).toEqual([0]);
  });

  it("linear: Vollüberlappung übernimmt 100 % des Item-Betrags", () => {
    const result = aggregateHeatingCosts(
      [
        {
          amountCents: 100_000,
          periodStart: "2025-01-01",
          periodEnd: "2025-12-31",
        },
      ],
      { start: "2025-01-01", end: "2025-12-31" },
      "linear",
    );
    expect(result.totalCents).toBe(100_000);
    expect(result.perItemAttributedCents).toEqual([100_000]);
  });

  it("linear: Teilüberlappung proportional zu Tagen", () => {
    // Item 105 Tage (01.01.-15.04.), Periode 01.04.-31.12. -> Overlap 15 Tage.
    const result = aggregateHeatingCosts(
      [
        {
          amountCents: 105_000,
          periodStart: "2025-01-01",
          periodEnd: "2025-04-15",
        },
      ],
      { start: "2025-04-01", end: "2025-12-31" },
      "linear",
    );
    // 105_000 x 15 / 105 = 15_000.
    expect(result.totalCents).toBe(15_000);
    expect(result.perItemAttributedCents).toEqual([15_000]);
  });

  it("degree_days: Winterüberlappung wiegt schwerer als linear", () => {
    // Item 105 Tage (01.01.-15.04.), Periode 01.04.-31.12.: Overlap nur die
    // 15 April-Tage (relativ warme Saison) - der Item-Anteil sollte deutlich
    // niedriger sein als linear 15/105 = 14,28 %.
    const result = aggregateHeatingCosts(
      [
        {
          amountCents: 105_000,
          periodStart: "2025-01-01",
          periodEnd: "2025-04-15",
        },
      ],
      { start: "2025-04-01", end: "2025-12-31" },
      "degree_days",
    );
    // 15 Tage April mit niedriger GTZ vs. Q1 (Jan/Feb/Mär hohe GTZ).
    // Erwarteter Anteil deutlich < 14,28 %.
    expect(result.totalCents).toBeLessThan(15_000);
    expect(result.totalCents).toBeGreaterThan(0);
  });

  it("sumDegreeDays: volles Jahr ergibt 1000 ‰ - auch im Schaltjahr", async () => {
    const { sumDegreeDays } = await import("./heating.js");
    // Normaljahr 2025
    expect(
      sumDegreeDays({ start: "2025-01-01", end: "2025-12-31" }),
    ).toBeCloseTo(1000, 6);
    // Schaltjahr 2024 - Februar hat 29 Tage, aber Summe Promille darf nicht
    // davon abweichen, weil der monatliche Anteil (170, 150, ...) konstant
    // bleibt und nur intern auf 29 statt 28 Tage verteilt wird.
    expect(
      sumDegreeDays({ start: "2024-01-01", end: "2024-12-31" }),
    ).toBeCloseTo(1000, 6);
    // Februar 2024 isoliert: 150 ‰ - egal ob 28 oder 29 Tage.
    expect(
      sumDegreeDays({ start: "2024-02-01", end: "2024-02-29" }),
    ).toBeCloseTo(150, 6);
  });

  it("degree_days: reine Sommerperiode fällt auf linear zurück (kein Div/0)", () => {
    // Juli/August haben in unseren GTZ-Werten je 10 - also nicht 0, aber sehr
    // wenig. Wir wählen daher ein Item mit echtem Summe-GTZ = 0 nicht direkt
    // konstruierbar. Stattdessen prüfen wir, dass auch im degree_days-Modus
    // Sommer-Items einen plausiblen Anteil liefern (Fallback-Pfad ist nicht
    // unterscheidbar von linear bei vollständiger Sommer-Überlappung).
    const result = aggregateHeatingCosts(
      [
        {
          amountCents: 31_000,
          periodStart: "2025-07-01",
          periodEnd: "2025-07-31",
        },
      ],
      { start: "2025-07-01", end: "2025-07-31" },
      "degree_days",
    );
    expect(result.totalCents).toBe(31_000);
  });

  it("aggregiert mehrere Items linear", () => {
    const result = aggregateHeatingCosts(
      [
        {
          amountCents: 105_000,
          periodStart: "2025-01-01",
          periodEnd: "2025-04-15",
        },
        {
          amountCents: 365_000,
          periodStart: "2025-04-16",
          periodEnd: "2026-04-15",
        },
      ],
      { start: "2025-04-01", end: "2025-12-31" },
      "linear",
    );
    // Item 1: 105_000 x 15 / 105 = 15_000.
    // Item 2: 365_000 x 260 / 365 = 260_000.
    expect(result.totalCents).toBe(275_000);
    expect(result.perItemAttributedCents).toEqual([15_000, 260_000]);
  });

  it("rechnet CO2-Kosten und -Menge mit demselben Periodenfaktor anteilig zu", () => {
    // Rechnung über 2024 (366 Tage), Statement deckt nur das halbe Jahr ab.
    const result = aggregateHeatingCosts(
      [
        {
          amountCents: 100_000,
          co2CostCents: 10_000,
          co2AmountGrams: 2_000_000,
          periodStart: "2024-01-01",
          periodEnd: "2024-12-31",
        },
      ],
      { start: "2024-01-01", end: "2024-06-30" }, // 182 Tage
      "linear",
    );
    const factor = 182 / 366;
    expect(result.totalCents).toBe(Math.round(100_000 * factor));
    expect(result.totalCo2CostCents).toBe(Math.round(10_000 * factor));
    expect(result.totalCo2AmountGrams).toBe(Math.round(2_000_000 * factor));
  });
});

describe("co2LandlordSharePercent (CO2KostAufG Stufenmodell, Wohngebäude)", () => {
  it("ordnet kg/qm x a der korrekten Stufe zu", () => {
    expect(co2LandlordSharePercent(0)).toBe(0);
    expect(co2LandlordSharePercent(11.99)).toBe(0);
    expect(co2LandlordSharePercent(12)).toBe(10);
    expect(co2LandlordSharePercent(16.99)).toBe(10);
    expect(co2LandlordSharePercent(17)).toBe(20);
    expect(co2LandlordSharePercent(17.5)).toBe(20);
    expect(co2LandlordSharePercent(51.99)).toBe(80);
    expect(co2LandlordSharePercent(52)).toBe(95);
    expect(co2LandlordSharePercent(100)).toBe(95);
  });

  it("liefert die Stufengrenzen für die Einstufungsanzeige", () => {
    expect(co2Tier(5)).toEqual({
      minInclusive: 0,
      maxExclusive: 12,
      landlordPercent: 0,
    });
    expect(co2Tier(17.5)).toEqual({
      minInclusive: 17,
      maxExclusive: 22,
      landlordPercent: 20,
    });
    const top = co2Tier(60);
    expect(top.minInclusive).toBe(52);
    expect(top.maxExclusive).toBe(Number.POSITIVE_INFINITY);
    expect(top.landlordPercent).toBe(95);
  });
});

describe("calculateCo2Split", () => {
  it("rechnet Ausstoß, Stufe und Abzug für ein volles Jahr (Beispiel 17,5 -> 20 %)", () => {
    const split = calculateCo2Split({
      totalCostCents: 11_770,
      totalAmountGrams: 3_500_000, // 3.500 kg
      livingAreaSqm: 200,
      periodDays: 365,
    });
    expect(split.emissionsKgPerSqmYear).toBeCloseTo(17.5, 5);
    expect(split.landlordSharePercent).toBe(20);
    // 20 % von 117,70 € = 23,54 €.
    expect(split.landlordDeductionCents).toBe(2354);
  });

  it("rechnet bei Teil-Abrechnungszeitraum auf ein Jahr hoch", () => {
    // Halbes Jahr, halbe Jahresmenge -> aufs Jahr gerechnet dieselbe Intensität
    const split = calculateCo2Split({
      totalCostCents: 10_000,
      totalAmountGrams: 1_750_000, // 1.750 kg in 182 Tagen
      livingAreaSqm: 200,
      periodDays: 182,
    });
    // (1750/200) x (365/182) ~= 17,55 -> Stufe 17..<22 -> 20 %.
    expect(split.emissionsKgPerSqmYear).toBeCloseTo(17.55, 1);
    expect(split.landlordSharePercent).toBe(20);
  });
});

describe("calculateHeating mit CO2KostAufG", () => {
  const baseInput = {
    config: { consumptionShareBps: 7000 },
    units: [unitEg, unitOg],
    consumptionMethod: "heat_meter" as const,
    consumptionMeters: [
      {
        meter: heatMeter("wmz-eg", "unit-eg"),
        readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
      },
      {
        meter: heatMeter("wmz-og", "unit-og"),
        readings: [reading("2025-01-01", 0), reading("2025-12-31", 300)],
      },
    ],
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  };

  it("zieht den Vermieteranteil aus dem Topf, bevor verteilt wird", () => {
    const result = calculateHeating({
      ...baseInput,
      totalHeatingCostsCents: 100_000, // Brutto-Topf 1.000 €
      co2: {
        enabled: true,
        totalCostCents: 10_000, // 100 € CO2-Kosten im Topf
        totalAmountGrams: 3_500_000, // 17,5 kg/qm x a bei 200 qm
        livingAreaSqm: 200,
        periodDays: 365,
      },
    });
    // 20 % von 100 € = 20 € Abzug -> Netto-Topf 980 €.
    expect(result.co2Detail?.landlordSharePercent).toBe(20);
    expect(result.co2Detail?.landlordDeductionCents).toBe(2000);
    expect(result.co2Detail?.emissionsKgPerSqmYear).toBeCloseTo(17.5, 5);
    expect(result.totalHeatingCostsCents).toBe(98_000);
    expect(result.consumptionPortionCents).toBe(68_600);
    expect(result.basicPortionCents).toBe(29_400);
    // Invariante: Verbrauch + Grund == verteilter (Netto-)Topf.
    expect(result.consumptionPortionCents + result.basicPortionCents).toBe(
      result.totalHeatingCostsCents,
    );
  });

  it("lässt den Topf unangetastet, wenn die Aufteilung deaktiviert ist", () => {
    const result = calculateHeating({
      ...baseInput,
      totalHeatingCostsCents: 100_000,
      co2: {
        enabled: false,
        totalCostCents: 10_000,
        totalAmountGrams: 3_500_000,
        livingAreaSqm: 200,
        periodDays: 365,
      },
    });
    expect(result.co2Detail).toBeUndefined();
    expect(result.totalHeatingCostsCents).toBe(100_000);
  });

  it("warnt und teilt nicht auf, wenn CO2-Kosten ohne CO2-Menge vorliegen", () => {
    const result = calculateHeating({
      ...baseInput,
      totalHeatingCostsCents: 100_000,
      co2: {
        enabled: true,
        totalCostCents: 10_000,
        totalAmountGrams: 0, // Menge fehlt -> keine Einstufung möglich
        livingAreaSqm: 200,
        periodDays: 365,
      },
    });
    expect(result.co2Detail).toBeUndefined();
    expect(result.totalHeatingCostsCents).toBe(100_000);
    expect(result.warnings?.some((w) => w.code === "co2SplitMissingData")).toBe(
      true,
    );
  });

  it("warnt, wenn die Aufteilung aktiviert ist, aber keiner Kostenart CO2-Kosten zugeordnet sind", () => {
    const result = calculateHeating({
      ...baseInput,
      totalHeatingCostsCents: 100_000,
      co2: {
        enabled: true,
        totalCostCents: 0, // keine Kostenart mit CO2-Kosten hinterlegt
        totalAmountGrams: 3_500_000,
        livingAreaSqm: 200,
        periodDays: 365,
      },
    });
    expect(result.co2Detail).toBeUndefined();
    expect(result.totalHeatingCostsCents).toBe(100_000);
    expect(
      result.warnings?.some((w) => w.code === "co2SplitEnabledNoData"),
    ).toBe(true);
  });
});

describe("calculateHeating - Warmwasser-Abspaltung (§ 9 Abs. 2 HeizkostenV)", () => {
  // Gemeinsames Setup: 100.000 Cent Topf, WMZ EG 100 kWh / OG 300 kWh.
  const baseInput = () => ({
    totalHeatingCostsCents: 100_000,
    config: { consumptionShareBps: 7000 },
    units: [unitEg, unitOg],
    consumptionMethod: "heat_meter" as const,
    consumptionMeters: [
      {
        meter: heatMeter("wmz-eg", "unit-eg"),
        readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
      },
      {
        meter: heatMeter("wmz-og", "unit-og"),
        readings: [reading("2025-01-01", 0), reading("2025-12-31", 300)],
      },
    ],
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  });

  it("spaltet den gemessenen Warmwasseranteil (Boiler-WMZ) anteilig ab", () => {
    // Q_WW 2.000 kWh von Q_gesamt 10.000 kWh = 20 % -> WW-Topf 20.000 Cent,
    // Heiztopf 80.000 Cent. Heizung + Warmwasser + Vermieter = 100.000.
    const result = calculateHeating({
      ...baseInput(),
      hotWater: {
        totalHeatEnergyKwh: 10_000,
        boilerHeatKwh: 2000,
        hotWaterVolumeM3: null,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [
          { unitId: "unit-eg", m3: 30 },
          { unitId: "unit-og", m3: 70 },
        ],
      },
    });

    expect(result.hotWaterDetail?.method).toBe("boiler_meter");
    expect(result.hotWaterDetail?.hotWaterShareBps).toBe(2000);
    expect(result.hotWaterDetail?.hotWaterPotCents).toBe(20_000);
    expect(result.heatingPotCents).toBe(80_000);
    // Heizungs-Verteilung läuft jetzt auf 80.000 (70/30).
    expect(result.consumptionPortionCents).toBe(56_000);
    expect(result.basicPortionCents).toBe(24_000);

    const heatingSum = result.perUnit.reduce((acc, u) => acc + u.totalCents, 0);
    const hwSum = (result.hotWaterDetail?.perUnit ?? []).reduce(
      (acc, u) => acc + u.totalCents,
      0,
    );
    // Vollbelegung, kein Leerstand -> Heizung + Warmwasser = ganzer Netto-Topf.
    expect(heatingSum + hwSum).toBe(100_000);
  });

  it("Warmwasser-Verbrauchsanteil folgt den Warmwasserzählern", () => {
    const result = calculateHeating({
      ...baseInput(),
      hotWater: {
        totalHeatEnergyKwh: 10_000,
        boilerHeatKwh: 2000,
        hotWaterVolumeM3: null,
        supplyTemperatureCelsius: 60,
        // EG 25 %, OG 75 % des Warmwasserverbrauchs.
        unitHotWaterM3: [
          { unitId: "unit-eg", m3: 25 },
          { unitId: "unit-og", m3: 75 },
        ],
      },
    });
    const hw = result.hotWaterDetail;
    expect(hw?.consumptionDistributionMethod).toBe("consumption");
    // WW-Topf 20.000 -> Verbrauch 14.000 (70 %), Grund 6.000 (30 %).
    expect(hw?.consumptionPortionCents).toBe(14_000);
    expect(hw?.basicPortionCents).toBe(6000);
    const egHw = hw?.perUnit.find((u) => u.unitId === "unit-eg");
    // Verbrauch EG = 14.000 x 0,25 = 3.500; Grund EG = 6.000 x 0,40 = 2.400.
    expect(egHw?.consumptionCostCents).toBe(3500);
    expect(egHw?.basicCostCents).toBe(2400);
  });

  it("ohne Boiler-WMZ wird Q_WW über die Schätzformel ermittelt", () => {
    // Q_WW = 2,5 x 50 m3 x (60 − 10) = 6.250 kWh.
    const result = calculateHeating({
      ...baseInput(),
      hotWater: {
        totalHeatEnergyKwh: 25_000,
        boilerHeatKwh: null,
        hotWaterVolumeM3: 50,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [
          { unitId: "unit-eg", m3: 20 },
          { unitId: "unit-og", m3: 30 },
        ],
      },
    });
    expect(result.hotWaterDetail?.method).toBe("estimated");
    expect(result.hotWaterDetail?.hotWaterHeatKwh).toBe(6250);
    // 6.250 / 25.000 = 25 % -> WW-Topf 25.000 Cent.
    expect(result.hotWaterDetail?.hotWaterShareBps).toBe(2500);
    expect(result.hotWaterDetail?.hotWaterPotCents).toBe(25_000);
    expect(result.heatingPotCents).toBe(75_000);
  });

  it("ohne WW-Zähler fällt der Verbrauchsanteil auf die Fläche zurück", () => {
    const result = calculateHeating({
      ...baseInput(),
      hotWater: {
        totalHeatEnergyKwh: 10_000,
        boilerHeatKwh: 2000,
        hotWaterVolumeM3: null,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [
          { unitId: "unit-eg", m3: 0 },
          { unitId: "unit-og", m3: 0 },
        ],
      },
    });
    expect(result.hotWaterDetail?.consumptionDistributionMethod).toBe(
      "heating_area",
    );
    // WW-Topf 20.000 vollständig nach Fläche (40/60) verteilt.
    const hwSum = (result.hotWaterDetail?.perUnit ?? []).reduce(
      (acc, u) => acc + u.totalCents,
      0,
    );
    expect(hwSum).toBe(20_000);
  });

  it("ohne Boiler-WMZ und ohne Warmwasserverbrauch greift die 32-kWh-Pauschalformel", () => {
    // Q_WW = 32 kWh/(m² x a) x 200 m² x (365/365 Tage) = 6.400 kWh.
    const result = calculateHeating({
      ...baseInput(),
      hotWater: {
        totalHeatEnergyKwh: 25_600,
        boilerHeatKwh: null,
        hotWaterVolumeM3: null,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [],
      },
    });
    expect(result.hotWaterDetail?.method).toBe("flat_rate_fallback");
    expect(result.hotWaterDetail?.hotWaterHeatKwh).toBe(6400);
    // 6.400 / 25.600 = 25 % -> WW-Topf 25.000 Cent.
    expect(result.hotWaterDetail?.hotWaterShareBps).toBe(2500);
    expect(result.hotWaterDetail?.hotWaterPotCents).toBe(25_000);
    expect(
      result.warnings?.some((w) => w.code === "hotWaterFlatRateFallback"),
    ).toBe(true);
  });

  it("fehlende Q_gesamt -> keine Abspaltung, Warnung gesetzt", () => {
    const result = calculateHeating({
      ...baseInput(),
      hotWater: {
        totalHeatEnergyKwh: null,
        boilerHeatKwh: 2000,
        hotWaterVolumeM3: null,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [],
      },
    });
    expect(result.hotWaterDetail).toBeUndefined();
    expect(result.heatingPotCents).toBe(100_000);
    expect(
      result.warnings?.some((w) => w.code === "hotWaterTotalHeatMissing"),
    ).toBe(true);
  });

  it("Q_WW > Q_gesamt wird auf 100 % begrenzt (mit Warnung)", () => {
    const result = calculateHeating({
      ...baseInput(),
      hotWater: {
        totalHeatEnergyKwh: 1000,
        boilerHeatKwh: 5000,
        hotWaterVolumeM3: null,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [
          { unitId: "unit-eg", m3: 30 },
          { unitId: "unit-og", m3: 70 },
        ],
      },
    });
    expect(result.hotWaterDetail?.hotWaterShareBps).toBe(10_000);
    expect(result.hotWaterDetail?.hotWaterPotCents).toBe(100_000);
    expect(result.heatingPotCents).toBe(0);
    expect(result.warnings?.some((w) => w.code === "hotWaterShareCapped")).toBe(
      true,
    );
  });
});
