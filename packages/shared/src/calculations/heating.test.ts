import { describe, expect, it } from "vitest";
import type { HeatingFuelType } from "../schemas/heating.js";
import type { MeterInfo, ReadingPoint, UnitInfo } from "../types/index.js";
import { hasBlockingWarning } from "./diagnostics.js";
import {
  aggregateHeatingCosts,
  type Co2FuelBasisEntry,
  type Co2FuelGroup,
  calculateCo2Split,
  calculateExternalHeating,
  calculateHeating,
  co2AppliedLandlordSharePercent,
  co2BasisMismatchKg,
  co2LandlordSharePercent,
  co2RestrictionInPeriod,
  co2Tier,
  hotWaterCorrectionFactor,
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
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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
      config: { consumptionShareBps: 5000, baseMethod: "heated_area" as const },
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
        config: {
          consumptionShareBps: 7000,
          baseMethod: "heated_area" as const,
        },
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
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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
        config: {
          consumptionShareBps: 7000,
          baseMethod: "heated_area" as const,
        },
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
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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

  it("markiert Zähler ohne Ablesung am Stichtag als rechnerisch ermittelt", () => {
    const result = calculateHeating({
      totalHeatingCostsCents: 10_000,
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_meter",
      consumptionMeters: [
        {
          // Ablesungen genau auf beiden Stichtagen -> echter Verbrauch.
          meter: heatMeter("wmz-eg", "unit-eg"),
          readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
        },
        {
          // Keine Ablesung zum Periodenende -> Stand wird hochgerechnet.
          meter: heatMeter("wmz-og", "unit-og"),
          readings: [reading("2025-01-01", 0), reading("2025-11-30", 300)],
        },
      ],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    const eg = result.perMeter?.find((m) => m.meterId === "wmz-eg");
    const og = result.perMeter?.find((m) => m.meterId === "wmz-og");
    expect(eg?.consumptionIsDerived).toBeUndefined();
    expect(og?.consumptionIsDerived).toBe(true);
  });

  it("wirft bei Type-Mismatch zwischen consumptionMethod und Zähler", () => {
    expect(() =>
      calculateHeating({
        totalHeatingCostsCents: 10_000,
        config: {
          consumptionShareBps: 7000,
          baseMethod: "heated_area" as const,
        },
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
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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
    // Apr-Dez stand EG leer -> Vermieter-Gewicht = 200x1.000 - 156.000 =
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
    // Gradtagszahlen (§ 9b Abs. 2 HeizkostenV) -> der Winter-Mieter trägt mehr.
    const baseInput = {
      totalHeatingCostsCents: 1_000_000,
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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

  describe("Brennstoffgruppen (§ 7 Abs. 3 CO2KostAufG)", () => {
    const year = { start: "2024-01-01", end: "2024-12-31" };
    const fuelItem = (
      overrides: Partial<Parameters<typeof aggregateHeatingCosts>[0][number]>,
    ) => ({
      costTypeId: "gas",
      amountCents: 100_000,
      co2CostCents: 10_000,
      co2AmountGrams: 2_000_000,
      co2EnergyKwh: 10_000,
      co2EmissionFactorKgPerKwh: 0.2,
      periodStart: "2024-01-01",
      periodEnd: "2024-12-31",
      ...overrides,
    });

    it("bildet aus einer Position eine Gruppe mit den eingegebenen Werten", () => {
      const result = aggregateHeatingCosts([fuelItem({})], year);

      expect(result.co2Groups).toEqual([
        {
          costTypeId: "gas",
          emissionFactorKgPerKwh: 0.2,
          energyKwh: 10_000,
          amountGrams: 2_000_000,
          costCents: 10_000,
        },
      ]);
    });

    it.each([
      "linear",
      "degree_days",
    ] as const)("kürzt Energiegehalt und Menge mit demselben Faktor (%s), der Emissionsfaktor bleibt", (method) => {
      const half = { start: "2024-01-01", end: "2024-06-30" };
      const result = aggregateHeatingCosts([fuelItem({})], half, method);
      const [group] = result.co2Groups;
      const factor = result.totalCo2AmountGrams / 2_000_000;

      expect(factor).toBeGreaterThan(0);
      expect(factor).toBeLessThan(1);
      expect(group?.energyKwh).toBe(Math.round(10_000 * factor));
      expect(group?.amountGrams).toBe(result.totalCo2AmountGrams);
      expect(group?.emissionFactorKgPerKwh).toBe(0.2);
    });

    it("fasst Positionen gleicher Kostenart mit gleichem Faktor zusammen", () => {
      const result = aggregateHeatingCosts(
        [
          fuelItem({}),
          // Als Gleitkommazahl von 0,3 verschieden, als Faktor derselbe.
          fuelItem({ co2EmissionFactorKgPerKwh: 0.3 }),
          fuelItem({ co2EmissionFactorKgPerKwh: 0.1 + 0.2 }),
        ],
        year,
      );

      expect(result.co2Groups).toHaveLength(2);
      expect(result.co2Groups[1]).toMatchObject({
        energyKwh: 20_000,
        amountGrams: 4_000_000,
        costCents: 20_000,
      });
    });

    it("trennt nach Kostenart, auch bei gleichem Faktor", () => {
      const result = aggregateHeatingCosts(
        [fuelItem({}), fuelItem({ costTypeId: "oil" })],
        year,
      );

      expect(result.co2Groups.map((group) => group.costTypeId)).toEqual([
        "gas",
        "oil",
      ]);
    });

    it("zeigt keine Teilsumme, wenn einer Position der Energiegehalt fehlt", () => {
      const result = aggregateHeatingCosts(
        [fuelItem({}), fuelItem({ co2EnergyKwh: null })],
        year,
      );

      expect(result.co2Groups).toEqual([
        {
          costTypeId: "gas",
          emissionFactorKgPerKwh: 0.2,
          energyKwh: null,
          amountGrams: 4_000_000,
          costCents: 20_000,
        },
      ]);
    });

    it("führt Positionen ohne Faktor als eigene Gruppe", () => {
      const result = aggregateHeatingCosts(
        [fuelItem({}), fuelItem({ co2EmissionFactorKgPerKwh: null })],
        year,
      );

      expect(
        result.co2Groups.map((group) => group.emissionFactorKgPerKwh),
      ).toEqual([0.2, null]);
    });

    it("hält CO2-Kosten ohne CO2-Menge in der Gruppe und meldet die Menge als fehlend", () => {
      const result = aggregateHeatingCosts(
        [
          fuelItem({}),
          fuelItem({ co2AmountGrams: null, co2CostCents: 4000 }),
          // Andere Kostenart, weder Faktor noch Menge erfasst.
          fuelItem({
            costTypeId: "oil",
            co2AmountGrams: null,
            co2EnergyKwh: null,
            co2EmissionFactorKgPerKwh: null,
          }),
        ],
        year,
      );

      expect(result.co2Groups).toEqual([
        {
          costTypeId: "gas",
          emissionFactorKgPerKwh: 0.2,
          energyKwh: 20_000,
          amountGrams: null,
          costCents: 14_000,
        },
        {
          costTypeId: "oil",
          emissionFactorKgPerKwh: null,
          energyKwh: null,
          amountGrams: null,
          costCents: 10_000,
        },
      ]);
      // Die Gesamtwerte kommen unverändert aus der bisherigen Rechnung.
      expect(result.totalCo2AmountGrams).toBe(2_000_000);
      expect(result.totalCo2CostCents).toBe(24_000);
    });

    it("meldet nicht erfasste CO2-Kosten als fehlend, eine eingetragene 0 bleibt 0", () => {
      const result = aggregateHeatingCosts(
        [
          fuelItem({ co2CostCents: null }),
          fuelItem({ costTypeId: "oil", co2CostCents: 0 }),
        ],
        year,
      );

      expect(result.co2Groups.map((group) => group.costCents)).toEqual([
        null,
        0,
      ]);
      expect(result.co2Groups.map((group) => group.amountGrams)).toEqual([
        2_000_000, 2_000_000,
      ]);
    });

    it("bildet keine Gruppe ohne CO2-Menge und -Kosten oder außerhalb des Zeitraums", () => {
      const result = aggregateHeatingCosts(
        [
          fuelItem({ co2AmountGrams: null, co2CostCents: null }),
          fuelItem({ periodStart: "2023-01-01", periodEnd: "2023-12-31" }),
        ],
        year,
      );

      expect(result.co2Groups).toEqual([]);
    });

    it("ergibt über alle Gruppen genau die Gesamtmenge und die Gesamtkosten", () => {
      const result = aggregateHeatingCosts(
        [
          fuelItem({ periodStart: "2023-07-01", periodEnd: "2024-06-30" }),
          fuelItem({ co2EmissionFactorKgPerKwh: 0.18, co2CostCents: 3333 }),
          fuelItem({ costTypeId: "oil", co2AmountGrams: 777_777 }),
          // Unvollständige Positionen zählen in den Gesamtwerten als 0.
          fuelItem({ costTypeId: "pellets", co2AmountGrams: null }),
          fuelItem({ costTypeId: "coal", co2CostCents: null }),
        ],
        { start: "2024-01-01", end: "2024-09-30" },
      );
      const sum = (pick: (group: Co2FuelGroup) => number | null) =>
        result.co2Groups.reduce((acc, group) => acc + (pick(group) ?? 0), 0);

      expect(sum((group) => group.amountGrams)).toBe(
        result.totalCo2AmountGrams,
      );
      expect(sum((group) => group.costCents)).toBe(result.totalCo2CostCents);
    });
  });

  it("rechnet enthaltene Steuern/Abgaben mit demselben Periodenfaktor anteilig zu", () => {
    const result = aggregateHeatingCosts(
      [
        {
          amountCents: 100_000,
          containedTaxesCents: 25_000,
          periodStart: "2024-01-01",
          periodEnd: "2024-12-31",
        },
        {
          // Position ohne erfasste Steuern zählt nicht in die Summe
          amountCents: 50_000,
          periodStart: "2024-01-01",
          periodEnd: "2024-12-31",
        },
      ],
      { start: "2024-01-01", end: "2024-06-30" }, // 182 Tage
      "linear",
    );

    const factor = 182 / 366;
    expect(result.totalContainedTaxesCents).toBe(Math.round(25_000 * factor));
  });
});

describe("co2BasisMismatchKg", () => {
  it.each([
    [1.019, false],
    [1.021, true],
    [0.981, false],
    [0.979, true],
  ])("Abweichung um Faktor %s meldet %s", (ratio, expected) => {
    const result = co2BasisMismatchKg(1_000_000, 10_000 * ratio, 0.1);

    expect(result !== null).toBe(expected);
  });

  it("meldet Erdgas mit kWh Brennwert und heizwertbezogenem Faktor", () => {
    // 44.000 kWh Brennwert, ausgewiesene Menge passt zu 0,1814 kg/kWh.
    const amountGrams = Math.round(44_000 * 0.1814 * 1000);

    expect(co2BasisMismatchKg(amountGrams, 44_000, 0.200_88)).toBeCloseTo(
      8838.72,
      2,
    );
    expect(co2BasisMismatchKg(amountGrams, 44_000, 0.1814)).toBeNull();
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

describe("calculateHeating - Zeitraum der CO2-Einstufung", () => {
  const run = (periodStart: string, periodEnd: string, kgPerSqm: number) =>
    calculateHeating({
      totalHeatingCostsCents: 100_000,
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_meter",
      consumptionMeters: [
        {
          meter: heatMeter("wmz-eg", "unit-eg"),
          readings: [reading(periodStart, 0), reading(periodEnd, 100)],
        },
        {
          meter: heatMeter("wmz-og", "unit-og"),
          readings: [reading(periodStart, 0), reading(periodEnd, 300)],
        },
      ],
      periodStart,
      periodEnd,
      co2: {
        enabled: true,
        totalCostCents: 10_000,
        totalAmountGrams: Math.round(kgPerSqm * 200 * 1000),
      },
    });

  it("stuft das volle Schaltjahr ohne Umrechnung ein", () => {
    const result = run("2024-01-01", "2024-12-31", 16.96);

    expect(result.co2Detail?.emissionsKgPerSqmYear).toBe(17);
    expect(result.co2Detail?.periodShare).toBeUndefined();
  });

  it("nimmt den Abrechnungszeitraum des Gebäudes und kürzt die Grenzwerte", () => {
    const result = run("2027-03-01", "2027-10-31", 7.96);

    expect(result.co2Detail).toMatchObject({
      emissionsKgPerSqmPeriod: 8,
      periodShare: { numerator: 2, denominator: 3 },
      landlordSharePercent: 10,
      landlordDeductionCents: 1000,
    });
    expect(result.co2Detail?.emissionsKgPerSqmYear).toBeUndefined();
    // Abzug des Vermieters plus verteilter Topf ergibt die Gesamtkosten
    expect(result.totalHeatingCostsCents).toBe(99_000);
  });
});

describe("calculateCo2Split", () => {
  const split = (
    periodStart: string,
    periodEnd: string,
    kgPerSqm: number,
    livingAreaSqm = 200,
  ) =>
    calculateCo2Split({
      totalCostCents: 10_000,
      totalAmountGrams: Math.round(kgPerSqm * livingAreaSqm * 1000),
      livingAreaSqm,
      periodStart,
      periodEnd,
    });
  const fullYear = (kgPerSqm: number) =>
    split("2027-01-01", "2027-12-31", kgPerSqm, 100);

  it("rechnet Ausstoß, Stufe und Abzug für ein volles Jahr (Beispiel 17,5 -> 20 %)", () => {
    const result = calculateCo2Split({
      totalCostCents: 11_770,
      totalAmountGrams: 3_500_000, // 3.500 kg
      livingAreaSqm: 200,
      periodStart: "2027-01-01",
      periodEnd: "2027-12-31",
    });
    expect(result.emissionsKgPerSqmYear).toBeCloseTo(17.5, 5);
    expect(result.landlordSharePercent).toBe(20);
    // 20 % von 117,70 € = 23,54 €.
    expect(result.landlordDeductionCents).toBe(2354);
  });

  it.each([
    ["über den Jahreswechsel", "2027-07-01", "2028-06-30"],
    ["über den Schalttag", "2027-03-01", "2028-02-29"],
    ["ab dem 29.02.", "2028-02-29", "2029-02-28"],
    ["nach dem Schalttag", "2028-03-01", "2029-02-28"],
  ])("rechnet das volle Jahr %s nicht um", (_name, periodStart, periodEnd) => {
    // 16,96 -> 17,0 -> 20 %. Jede Umrechnung nach Tagen ergäbe einen
    // anderen Wert als die Menge je Fläche.
    const result = split(periodStart, periodEnd, 16.96);

    expect(result.emissionsKgPerSqmYear).toBe(17);
    expect(result.emissionsKgPerSqmPeriod).toBeUndefined();
    expect(result.periodShare).toBeUndefined();
    expect(result.landlordSharePercent).toBe(20);
  });

  it("rundet den Ausstoß auf eine Nachkommastelle, bevor eingestuft wird", () => {
    // 16,96 -> 17,0 -> Stufe 17..<22 -> 20 %; ungerundet wären es 10 %.
    expect(fullYear(16.96).emissionsKgPerSqmYear).toBe(17);
    expect(fullYear(16.96).landlordSharePercent).toBe(20);
    // 16,94 -> 16,9 -> bleibt unter 17 -> 10 %.
    expect(fullYear(16.94).emissionsKgPerSqmYear).toBe(16.9);
    expect(fullYear(16.94).landlordSharePercent).toBe(10);
    // 11,95 -> 12,0 -> Stufe 12..<17 -> 10 %.
    expect(fullYear(11.95).emissionsKgPerSqmYear).toBe(12);
    expect(fullYear(11.95).landlordSharePercent).toBe(10);
    // 11,94 -> 11,9 -> bleibt unter 12 -> 0 %.
    expect(fullYear(11.94).emissionsKgPerSqmYear).toBe(11.9);
    expect(fullYear(11.94).landlordSharePercent).toBe(0);
  });

  describe("Abrechnungszeitraum unter einem Jahr (§ 5 Abs. 1 Satz 4 CO2KostAufG)", () => {
    it.each([
      // 7,96 -> 8,0 erreicht die gekürzte Grenze 8,00. Hochgerechnet wären
      // es 11,9 und 0 %.
      ["2027-03-01", "2027-10-31", 7.96, 8, 10],
      // 11,31 -> 11,3 bleibt unter 11,33. Hochgerechnet wären es 17,0 und
      // 20 %.
      ["2027-01-01", "2027-08-31", 11.31, 11.3, 10],
      // Acht Monate sind zwei Drittel, nicht 245 von 365 Tagen.
      ["2027-03-01", "2027-10-31", 8.02, 8, 10],
    ])("%s bis %s mit %f kg/qm", (periodStart, periodEnd, kgPerSqm, rounded, percent) => {
      const result = split(periodStart, periodEnd, kgPerSqm);

      expect(result.emissionsKgPerSqmPeriod).toBe(rounded);
      expect(result.emissionsKgPerSqmYear).toBeUndefined();
      expect(result.periodShare).toEqual({ numerator: 2, denominator: 3 });
      expect(result.landlordSharePercent).toBe(percent);
    });

    it("rechnet den Abzug vom gekürzt eingestuften Anteil", () => {
      const result = split("2027-03-01", "2027-10-31", 7.96);

      expect(result.landlordDeductionCents).toBe(1000);
    });
  });
});

describe("co2Tier mit gekürzten Grenzwerten", () => {
  const twoThirds = { numerator: 2, denominator: 3 };
  const half = { numerator: 1, denominator: 2 };

  it("erreicht die Stufe genau auf der Grenze, ein Zehntel darunter nicht", () => {
    expect(co2LandlordSharePercent(8, twoThirds)).toBe(10);
    expect(co2LandlordSharePercent(7.9, twoThirds)).toBe(0);
  });

  it("vergleicht mit dem genauen Bruch, wenn der Grenzwert kein Zehntel ist", () => {
    // 17 x 2/3 = 11,333
    expect(co2LandlordSharePercent(11.3, twoThirds)).toBe(10);
    expect(co2LandlordSharePercent(11.4, twoThirds)).toBe(20);
  });

  it.each([
    [12, 10],
    [17, 20],
    [22, 30],
    [27, 40],
    [32, 50],
    [37, 60],
    [42, 70],
    [47, 80],
    [52, 95],
  ])("halbes Jahr: Grenze %i wird bei der Hälfte erreicht (%i %%)", (limit, percent) => {
    const reached = co2Tier(limit / 2, half);

    expect(reached.landlordPercent).toBe(percent);
    // Die Stufe trägt weiter die Werte der Anlage
    expect(reached.minInclusive).toBe(limit);
    expect(
      co2LandlordSharePercent(Math.round(limit * 5 - 1) / 10, half),
    ).toBeLessThan(percent);
  });

  it("folgt dem genauen Grenzwert, nicht dem gerundeten Anzeigewert", () => {
    // 01.01. bis 28.01.2027: 12 x 7/93 = 0,9032, angezeigt 0,90
    const share = { numerator: 7, denominator: 93 };

    expect(co2LandlordSharePercent(0.9, share)).toBe(0);
    expect(co2LandlordSharePercent(1, share)).toBe(10);
  });
});

describe("calculateHeating mit CO2KostAufG", () => {
  const baseInput = {
    config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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
      },
    });
    expect(result.co2Detail).toBeUndefined();
    expect(result.totalHeatingCostsCents).toBe(100_000);
    expect(result.warnings?.some((w) => w.code === "co2SplitMissingData")).toBe(
      true,
    );
  });

  describe("Berechnungsgrundlagen", () => {
    const co2 = {
      enabled: true,
      totalCostCents: 20_000,
      totalAmountGrams: 3_500_000,
    };
    const group = {
      label: "Gas",
      energyKwh: 17_500,
      emissionFactorKgPerKwh: 0.2,
      amountGrams: 3_500_000,
      costCents: 20_000,
    };
    const run = (co2Input: typeof co2 & { fuelBasis?: Co2FuelBasisEntry[] }) =>
      calculateHeating({
        ...baseInput,
        totalHeatingCostsCents: 100_000,
        co2: co2Input,
      });
    const hasWarning = (result: ReturnType<typeof run>, code: string) =>
      result.warnings?.some((w) => w.code === code) ?? false;

    it("reicht vollständige Gruppen ohne Warnung durch", () => {
      const result = run({ ...co2, fuelBasis: [group] });

      expect(result.co2Detail?.fuelBasis).toEqual([group]);
      expect(hasWarning(result, "co2BasisIncomplete")).toBe(false);
    });

    it("warnt bei fehlendem Energiegehalt oder Faktor, rechnet aber wie sonst", () => {
      const complete = run({ ...co2, fuelBasis: [group] });
      const incomplete = run({
        ...co2,
        fuelBasis: [{ ...group, emissionFactorKgPerKwh: null }],
      });

      expect(hasWarning(incomplete, "co2BasisIncomplete")).toBe(true);
      expect(incomplete.co2Detail?.landlordDeductionCents).toBe(
        complete.co2Detail?.landlordDeductionCents,
      );
      expect(incomplete.totalHeatingCostsCents).toBe(
        complete.totalHeatingCostsCents,
      );
    });

    it.each([
      "energyKwh",
      "emissionFactorKgPerKwh",
    ] as const)("fehlender Ausweiswert %s warnt nur und sperrt nicht", (field) => {
      const result = run({
        ...co2,
        fuelBasis: [group, { ...group, [field]: null }],
      });

      expect(hasWarning(result, "co2BasisIncomplete")).toBe(true);
      expect(hasWarning(result, "co2SplitValuesIncomplete")).toBe(false);
      expect(hasBlockingWarning({ heatingDetail: result })).toBe(false);
    });

    it.each([
      "amountGrams",
      "costCents",
    ] as const)("fehlender Rechenwert %s sperrt das Finalisieren, auch neben einer vollständigen Gruppe", (field) => {
      const result = run({
        ...co2,
        fuelBasis: [group, { ...group, [field]: null }],
      });

      expect(hasWarning(result, "co2SplitValuesIncomplete")).toBe(true);
      expect(hasWarning(result, "co2BasisIncomplete")).toBe(false);
      expect(hasBlockingWarning({ heatingDetail: result })).toBe(true);
      // Gerechnet wird trotzdem wie bisher, für die Vorschau.
      expect(result.co2Detail?.landlordDeductionCents).toBe(
        run({ ...co2, fuelBasis: [group] }).co2Detail?.landlordDeductionCents,
      );
    });

    it("eine eingetragene 0 bei Menge oder Kosten sperrt nicht", () => {
      const result = run({
        ...co2,
        fuelBasis: [group, { ...group, amountGrams: 0, costCents: 0 }],
      });

      expect(hasBlockingWarning({ heatingDetail: result })).toBe(false);
    });

    it("sperrt auch, wenn keiner Position die Menge erfasst ist und gar nicht aufgeteilt wird", () => {
      const result = run({
        ...co2,
        totalAmountGrams: 0,
        fuelBasis: [{ ...group, amountGrams: null }],
      });

      expect(result.co2Detail).toBeUndefined();
      expect(hasWarning(result, "co2SplitMissingData")).toBe(true);
      expect(hasBlockingWarning({ heatingDetail: result })).toBe(true);
    });

    it("sperrt nicht bei ausgeschalteter Aufteilung", () => {
      const result = run({
        ...co2,
        enabled: false,
        fuelBasis: [{ ...group, amountGrams: null }],
      });

      expect(hasBlockingWarning({ heatingDetail: result })).toBe(false);
    });

    it("von den Positionen bis zur Sperre: nur asymmetrische CO2-Angaben sperren", () => {
      const position = {
        costTypeId: "gas",
        amountCents: 100_000,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      };
      const blocked = (
        co2Fields: Partial<Parameters<typeof aggregateHeatingCosts>[0][number]>,
      ) => {
        const complete = {
          ...position,
          co2AmountGrams: 3_500_000,
          co2CostCents: 20_000,
          co2EnergyKwh: 17_500,
          co2EmissionFactorKgPerKwh: 0.2,
        };
        const aggregation = aggregateHeatingCosts(
          [complete, { ...position, ...co2Fields }],
          { start: "2025-01-01", end: "2025-12-31" },
        );
        const result = run({
          ...co2,
          totalCostCents: aggregation.totalCo2CostCents,
          totalAmountGrams: aggregation.totalCo2AmountGrams,
          fuelBasis: aggregation.co2Groups.map(({ costTypeId, ...rest }) => ({
            label: costTypeId,
            ...rest,
          })),
        });
        return hasBlockingWarning({ heatingDetail: result });
      };

      // Kosten ohne Menge und Menge ohne Kosten.
      expect(blocked({ co2CostCents: 5000 })).toBe(true);
      expect(blocked({ co2AmountGrams: 1_000_000 })).toBe(true);
      // Vollständig leere CO2-Felder (Wartung, Betriebsstrom).
      expect(blocked({})).toBe(false);
      expect(blocked({ co2AmountGrams: null, co2CostCents: null })).toBe(false);
      // Eine eingetragene 0 ist ein Wert.
      expect(blocked({ co2AmountGrams: 1_000_000, co2CostCents: 0 })).toBe(
        false,
      );
      expect(blocked({ co2AmountGrams: 0, co2CostCents: 5000 })).toBe(false);
      // Nur Ausweiswerte fehlen.
      expect(blocked({ co2AmountGrams: 1_000_000, co2CostCents: 5000 })).toBe(
        false,
      );
    });

    it("warnt bei ausgeschalteter Aufteilung nur, wenn CO2-Kosten erfasst sind", () => {
      const withCosts = run({ ...co2, enabled: false });
      const withoutCosts = run({ ...co2, enabled: false, totalCostCents: 0 });

      expect(withCosts.co2Detail).toBeUndefined();
      expect(hasWarning(withCosts, "co2DataWithoutSplit")).toBe(true);
      expect(hasWarning(withoutCosts, "co2DataWithoutSplit")).toBe(false);
    });
  });

  it("warnt, wenn die Aufteilung aktiviert ist, aber keiner Kostenart CO2-Kosten zugeordnet sind", () => {
    const result = calculateHeating({
      ...baseInput,
      totalHeatingCostsCents: 100_000,
      co2: {
        enabled: true,
        totalCostCents: 0, // keine Kostenart mit CO2-Kosten hinterlegt
        totalAmountGrams: 3_500_000,
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
    config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
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
    // Q_WW = 2,5 x 50 m3 x (60 - 10) = 6.250 kWh.
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
    expect(
      result.warnings?.some(
        (w) => w.code === "hotWaterConsumptionFallbackArea",
      ),
    ).toBe(true);
    // WW-Topf 20.000 vollständig nach Fläche (40/60) verteilt.
    const hwSum = (result.hotWaterDetail?.perUnit ?? []).reduce(
      (acc, u) => acc + u.totalCents,
      0,
    );
    expect(hwSum).toBe(20_000);
  });

  it("ohne Boiler-WMZ und ohne Warmwasserverbrauch greift die 32-kWh-Pauschalformel", () => {
    // Q_WW = 32 kWh/(qm x a) x 200 qm x (365/365 Tage) = 6.400 kWh.
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

  it("Q_gesamt bei Halbjahresperiode warnt nicht: Der Wert gilt für den Zeitraum", () => {
    const input = baseInput();
    const halfYear = calculateHeating({
      ...input,
      units: input.units.map((unit) => ({ ...unit, periodDays: 181 })),
      periodEnd: "2025-06-30",
      hotWater: {
        totalHeatEnergyKwh: 10_000,
        boilerHeatKwh: 2000,
        hotWaterVolumeM3: null,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [],
      },
    });

    expect(halfYear.hotWaterDetail).toBeDefined();
    expect(
      halfYear.warnings?.some(
        (w) => w.code === "hotWaterTotalHeatPeriodMismatch",
      ),
    ).not.toBe(true);
  });

  it("Korrekturfaktoren nach § 9 Abs. 2 greifen nur auf die Formel-Wärmemenge", () => {
    // Schätzformel: 2,5 x 40 m3 x (60 - 10) °C = 5.000 kWh von Q_gesamt
    // 20.000 kWh = 25%. Die Faktoren verschieben genau diesen Anteil.
    const estimated = (correctionFactor?: number) =>
      calculateHeating({
        ...baseInput(),
        hotWater: {
          totalHeatEnergyKwh: 20_000,
          boilerHeatKwh: null,
          hotWaterVolumeM3: 40,
          supplyTemperatureCelsius: 60,
          unitHotWaterM3: [],
          ...(correctionFactor === undefined ? {} : { correctionFactor }),
        },
      });

    expect(estimated().hotWaterDetail?.hotWaterHeatKwh).toBe(5000);
    expect(estimated().hotWaterDetail?.correctionFactor).toBeUndefined();

    // Erdgas brennwertbezogen: x 1,11
    expect(estimated(1.11).hotWaterDetail?.hotWaterHeatKwh).toBeCloseTo(
      5550,
      6,
    );
    expect(estimated(1.11).hotWaterDetail?.hotWaterShareBps).toBe(2775);
    expect(estimated(1.11).hotWaterDetail?.correctionFactor).toBe(1.11);

    // Gewerbliche Wärmelieferung: : 1,15
    expect(estimated(1 / 1.15).hotWaterDetail?.hotWaterHeatKwh).toBeCloseTo(
      5000 / 1.15,
      6,
    );

    // Monovalente Wärmepumpe: x 0,30
    expect(estimated(0.3).hotWaterDetail?.hotWaterHeatKwh).toBeCloseTo(1500, 6);

    // Am Wärmezähler gemessen: die Verordnung nennt nur die Formel-Werte,
    // der gemessene Wert bleibt unverändert.
    const measured = calculateHeating({
      ...baseInput(),
      hotWater: {
        totalHeatEnergyKwh: 20_000,
        boilerHeatKwh: 5000,
        hotWaterVolumeM3: null,
        supplyTemperatureCelsius: 60,
        unitHotWaterM3: [],
        correctionFactor: 1.11,
      },
    });
    expect(measured.hotWaterDetail?.method).toBe("boiler_meter");
    expect(measured.hotWaterDetail?.hotWaterHeatKwh).toBe(5000);
    expect(measured.hotWaterDetail?.correctionFactor).toBeUndefined();
  });

  it("hotWaterCorrectionFactor bildet die Konstellationen aus § 9 Abs. 2 ab", () => {
    const factor = (
      fuelType: HeatingFuelType,
      flags?: Partial<{
        gasBillingByCalorificValue: boolean;
        heatPumpMonovalent: boolean;
      }>,
    ) =>
      hotWaterCorrectionFactor({
        fuelType,
        gasBillingByCalorificValue: false,
        heatPumpMonovalent: false,
        ...flags,
      });

    expect(factor("oil")).toBe(1);
    expect(factor("gas")).toBe(1);
    expect(factor("gas", { gasBillingByCalorificValue: true })).toBe(1.11);
    expect(factor("district_heat")).toBeCloseTo(1 / 1.15, 12);
    expect(factor("heat_pump")).toBe(1);
    expect(factor("heat_pump", { heatPumpMonovalent: true })).toBe(0.3);
    // Flags ohne passenden Energieträger bleiben wirkungslos.
    expect(factor("oil", { gasBillingByCalorificValue: true })).toBe(1);
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

describe("calculateHeating - Warmwasser-Grundkosten nach Wohnfläche und zeitanteilig", () => {
  const boilerHotWater = (
    unitHotWaterM3: Array<{ unitId: string; m3: number }>,
  ) => ({
    totalHeatEnergyKwh: 10_000,
    boilerHeatKwh: 2000,
    hotWaterVolumeM3: null,
    supplyTemperatureCelsius: 60,
    unitHotWaterM3,
  });

  const input = (units: UnitInfo[]) => ({
    totalHeatingCostsCents: 100_000,
    config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
    units,
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

  it("verteilt Heizungs-Grundkosten nach Heizfläche, Warmwasser-Grundkosten nach Wohnfläche", () => {
    // EG: 80 qm Wohnfläche, aber nur 40 qm Heizfläche; OG 120 qm.
    const result = calculateHeating({
      ...input([{ ...unitEg, heatingAreaSqm: 40 }, unitOg]),
      hotWater: boilerHotWater([
        { unitId: "unit-eg", m3: 25 },
        { unitId: "unit-og", m3: 75 },
      ]),
    });

    // Heizungs-Grundkosten 24.000 nach Heizfläche 40 / 160.
    expect(
      result.perUnit.find((u) => u.unitId === "unit-eg")?.basicCostCents,
    ).toBe(6000);
    // Warmwasser-Grundkosten 6.000 nach Wohnfläche 80 / 200.
    const hwEg = result.hotWaterDetail?.perUnit.find(
      (u) => u.unitId === "unit-eg",
    );
    expect(hwEg?.basicCostCents).toBe(2400);
    expect(hwEg?.areaSqm).toBe(80);
    expect(result.hotWaterDetail?.basicAreaBasis).toBe("living_area");
  });

  it("teilt Warmwasser-Grundkosten auch bei Gradtag-Abrechnung nach Tagen", () => {
    // EG nur 181 Tage vermietet, in denen 700 ‰ der Gradtage liegen.
    const result = calculateHeating({
      ...input([
        {
          ...unitEg,
          occupiedDays: 181,
          occupiedDegreeDayPromille: 700,
          periodDegreeDayPromille: 1000,
        },
        {
          ...unitOg,
          occupiedDegreeDayPromille: 1000,
          periodDegreeDayPromille: 1000,
        },
      ]),
      prorationMethod: "degree_days",
      hotWater: boilerHotWater([
        { unitId: "unit-eg", m3: 25 },
        { unitId: "unit-og", m3: 75 },
      ]),
    });

    // Heizung: 24.000 nach qm x Gradtage: EG 80 x 700 von 200 x 1.000.
    expect(
      result.perUnit.find((u) => u.unitId === "unit-eg")?.basicCostCents,
    ).toBe(6720);
    // Warmwasser: 6.000 nach qm x Tage: EG 80 x 181, OG 120 x 365,
    // Vermieter 200 x 365 minus beides.
    const hw = result.hotWaterDetail;
    expect(
      hw?.perUnit.find((u) => u.unitId === "unit-eg")?.basicCostCents,
    ).toBe(1190);
    expect(
      hw?.perUnit.find((u) => u.unitId === "unit-og")?.basicCostCents,
    ).toBe(3600);
    expect(hw?.landlordBasicCostCents).toBe(1210);
  });

  it("nutzt dieselben Gewichte für den Flächen-Fallback des Warmwasser-Verbrauchsanteils", () => {
    const result = calculateHeating({
      ...input([{ ...unitEg, heatingAreaSqm: 40 }, unitOg]),
      hotWater: boilerHotWater([]),
    });

    const hw = result.hotWaterDetail;
    expect(hw?.consumptionDistributionMethod).toBe("heating_area");
    // Verbrauchsanteil 14.000 nach Wohnfläche 80 / 200.
    expect(
      hw?.perUnit.find((u) => u.unitId === "unit-eg")?.consumptionCostCents,
    ).toBe(5600);
    const hwSum =
      (hw?.perUnit ?? []).reduce((acc, u) => acc + u.totalCents, 0) +
      (hw?.landlordBasicCostCents ?? 0) +
      (hw?.landlordConsumptionCostCents ?? 0);
    expect(hwSum).toBe(hw?.hotWaterPotCents);
  });
});

describe("Beschränkungen nach § 9 CO2KostAufG", () => {
  const note = "Anschluss- und Benutzungszwang nach der Fernwärmesatzung";
  /**
   * 435,00 EUR CO2-Kosten, volles Jahr, 100 qm: der Ausstoß in kg/qm
   * bestimmt die Stufe.
   */
  const split = (
    kgPerSqm: number,
    building: boolean,
    supply: boolean,
    totalCostCents = 43_500,
  ) =>
    calculateCo2Split({
      totalCostCents,
      totalAmountGrams: kgPerSqm * 100_000,
      livingAreaSqm: 100,
      periodStart: "2027-01-01",
      periodEnd: "2027-12-31",
      restriction: { building, supply, evidenceNote: note },
    });

  it.each([
    // [kg/qm, Gebäude, Versorgung, angewendeter Anteil, Abzug]
    [17.5, false, false, 20, 8700],
    [17.5, true, false, 10, 4350],
    [17.5, false, true, 10, 4350],
    [17.5, true, true, 0, 0],
    // 206,625 EUR: der halbe Cent wird aufgerundet
    [60, true, false, 47.5, 20_663],
    [5, true, false, 0, 0],
  ])("%s kg/qm, Gebäude %s, Versorgung %s: %s %% und %s Cent", (kgPerSqm, building, supply, percent, deductionCents) => {
    const result = split(kgPerSqm, building, supply);

    expect(result.landlordSharePercent).toBe(percent);
    expect(result.landlordDeductionCents).toBe(deductionCents);
  });

  it("halbiert den Anteil jeder Stufe, die oberste ergibt 47,5 %", () => {
    const tablePercents = [0, 10, 20, 30, 40, 50, 60, 70, 80, 95];

    expect(
      tablePercents.map((percent) =>
        co2AppliedLandlordSharePercent(percent, false, true),
      ),
    ).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 47.5]);
  });

  it("rundet den Abzug nur einmal", () => {
    // round(5 x 10 / 200) = 0, nicht round(round(0,5) / 2) = 1
    expect(split(12, true, false, 5).landlordDeductionCents).toBe(0);
  });

  it("weist Tabellenanteil und Angaben nur mit Beschränkung aus", () => {
    const restricted = split(17.5, true, false);
    const unrestricted = split(17.5, false, false);

    expect(restricted.tableLandlordSharePercent).toBe(20);
    expect(restricted.restriction).toEqual({
      building: true,
      supply: false,
      evidenceNote: note,
    });
    expect(unrestricted.tableLandlordSharePercent).toBeUndefined();
    expect(unrestricted.restriction).toBeUndefined();
  });

  it("weist die Beschränkung auch bei Stufe 0 % aus", () => {
    const result = split(5, true, false);

    expect(result.tableLandlordSharePercent).toBe(0);
    expect(result.restriction?.building).toBe(true);
  });

  it.each([
    [true, false, 95_650],
    [true, true, 100_000],
  ])("erhält die Cents: Abzug plus verteilter Topf ergibt die Gesamtkosten (Gebäude %s, Versorgung %s)", (building, supply, potCents) => {
    const result = calculateHeating({
      config: { consumptionShareBps: 7000, baseMethod: "heated_area" as const },
      units: [unitEg, unitOg],
      consumptionMethod: "heat_meter",
      consumptionMeters: [],
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      totalHeatingCostsCents: 100_000,
      co2: {
        enabled: true,
        totalCostCents: 43_500,
        // 17,5 kg/qm bei 200 qm: Stufe 20 %, halbiert 10 %
        totalAmountGrams: 3_500_000,
        restriction: { building, supply, evidenceNote: note },
      },
    });

    expect(result.totalHeatingCostsCents).toBe(potCents);
    expect(
      result.totalHeatingCostsCents +
        (result.co2Detail?.landlordDeductionCents ?? 0),
    ).toBe(100_000);
    // Auch ohne Aufteilung bleibt die Einstufung ausgewiesen
    expect(result.co2Detail?.tableLandlordSharePercent).toBe(20);
  });

  describe("Wechsel im Abrechnungszeitraum", () => {
    const period = { start: "2026-01-01", end: "2026-12-31" };
    const version = (
      validFrom: string,
      validTo: string | null,
      fields: Partial<Parameters<typeof co2RestrictionInPeriod>[0][number]>,
    ) => ({
      mode: "internal" as const,
      validFrom,
      validTo,
      co2CostShareEnabled: true,
      co2BuildingRestricted: false,
      co2SupplyRestricted: false,
      co2RestrictionEvidenceNote: null,
      ...fields,
    });
    const building = { co2BuildingRestricted: true };
    const supply = { co2SupplyRestricted: true };

    it("meldet bei einer Version keinen Konflikt", () => {
      expect(
        co2RestrictionInPeriod([version("2020-01-01", null, building)], period)
          .conflict,
      ).toBe(false);
    });

    it("nimmt bei gleichen Angaben den Text der späteren Version", () => {
      expect(
        co2RestrictionInPeriod(
          [
            version("2026-07-01", null, {
              ...building,
              co2RestrictionEvidenceNote: "neu",
            }),
            version("2020-01-01", "2026-06-30", {
              ...building,
              co2RestrictionEvidenceNote: "alt",
            }),
          ],
          period,
        ),
      ).toEqual({ conflict: false, evidenceNote: "neu" });
    });

    it.each([
      ["mit und ohne Beschränkung", building, {}],
      ["Gebäude und Versorgung", building, supply],
    ])("meldet einen Konflikt: %s", (_label, first, second) => {
      expect(
        co2RestrictionInPeriod(
          [
            version("2020-01-01", "2026-06-30", first),
            version("2026-07-01", null, second),
          ],
          period,
        ).conflict,
      ).toBe(true);
    });

    it("zählt Versionen ohne Aufteilung, im externen Modus und außerhalb des Zeitraums nicht", () => {
      expect(
        co2RestrictionInPeriod(
          [
            version("2020-01-01", "2025-12-31", {}),
            version("2026-01-01", "2026-03-31", building),
            version("2026-04-01", "2026-06-30", { co2CostShareEnabled: false }),
            version("2026-07-01", "2026-12-31", { mode: "external" }),
            version("2027-01-01", null, supply),
          ],
          period,
        ).conflict,
      ).toBe(false);
    });

    it("sperrt das Finalisieren", () => {
      expect(
        hasBlockingWarning({
          heatingDetail: {
            warnings: [{ code: "co2RestrictionConflictInPeriod" }],
          },
        }),
      ).toBe(true);
    });
  });
});
