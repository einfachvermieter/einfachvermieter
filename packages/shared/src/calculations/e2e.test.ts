import { describe, expect, it } from "vitest";
import type {
  CostEntry,
  MeterInfo,
  ReadingPoint,
  UnitInfo,
} from "../types/index.js";
import { aggregateCostsForPeriod } from "./allocation.js";
import { calculateHeating } from "./heating.js";
import { calculateStatement, type StatementCalculationInput } from "./index.js";

/**
 * End-to-End-Szenario:
 * - Beispielhaus, 3 Parteien
 * - EG (Mieter1): 80 qm, 1 Bewohner, ohne eigene Wasserzähler (Differenzzähler)
 * - OG/DG (Mieter2): 120 qm, 2 Bewohner, eigener Wasserzähler, Gartenwasser (Allgemeinzähler)
 * - Gas-Zentralheizung mit Wärmemengenzähler (WMZ) in jeder Wohnung
 * - Hilfsstrom Therme
 * - Abrechnungsperiode: Kalenderjahr 2025
 * - Gas-Rechnung 01.08.2024 - 31.07.2025 (überläuft Abrechnungsjahr)
 *
 * Der Test stellt sicher, dass:
 * 1. Die Gas-Rechnung tagesgenau anteilig auf 2025 zugeordnet wird
 * 2. Die 70/30-Verteilung der HeizkostenV mit WMZ korrekt arbeitet
 * 3. Der Wasser-Differenzzähler in der EG-Wohnung korrekt berechnet wird
 * 4. Schmutzwasser analog zum Frischwasser verteilt wird
 * 5. Die Summe aller Tenant-Abrechnungen den Gesamtkosten entspricht (Rundung)
 */

const PERIOD_DAYS_2025 = 365;

const unitEg: UnitInfo = {
  id: "u-eg",
  name: "EG",
  areaSqm: 80,
  occupantCount: 1,
  personDays: PERIOD_DAYS_2025,
  occupiedDays: PERIOD_DAYS_2025,
  periodDays: PERIOD_DAYS_2025,
};
const unitOg: UnitInfo = {
  id: "u-og",
  name: "OG/DG",
  areaSqm: 120,
  occupantCount: 2,
  personDays: 2 * PERIOD_DAYS_2025,
  occupiedDays: PERIOD_DAYS_2025,
  periodDays: PERIOD_DAYS_2025,
};
const units = [unitEg, unitOg];

const reading = (date: string, value: number): ReadingPoint => ({
  date,
  value,
  isCumulative: true,
  isEstimated: false,
});

const meter = (
  id: string,
  type: MeterInfo["type"],
  role: MeterInfo["role"],
  unitId: string | null,
  label: string,
  extras: Partial<MeterInfo> = {},
): MeterInfo => ({
  id,
  type,
  role,
  unitId,
  label,
  measurementUnit: type === "heat_meter" ? "kwh" : "m3",
  validFrom: "1900-01-01",
  validUntil: null,
  ...extras,
});

describe("End-to-End Abrechnung 2025", () => {
  const periodStart = "2025-01-01";
  const periodEnd = "2025-12-31";

  // Gas-Rechnung überlappt Abrechnungsperiode (01.08.2024 - 31.07.2025)
  const gasCost: CostEntry = {
    id: "c-gas",
    costTypeId: "ct-gas",
    allocationKey: "heating_ordinance",
    name: "Gas",
    amountCents: 365_000, // 3650 EUR für 365 Tage
    periodStart: "2024-08-01",
    periodEnd: "2025-07-31",
  };

  // Hilfsstrom Therme 2025
  const heatingElectricityCost: CostEntry = {
    id: "c-strom",
    costTypeId: "ct-strom",
    allocationKey: "heating_ordinance",
    name: "Hilfsstrom Therme",
    amountCents: 10_000, // 100 EUR
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  };

  // Frischwasser 2025
  const waterCost: CostEntry = {
    id: "c-water",
    costTypeId: "ct-water",
    allocationKey: "per_consumption_m3",
    name: "Frischwasser",
    amountCents: 50_000, // 500 EUR
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  };

  // Schmutzwasser 2025
  const sewageCost: CostEntry = {
    id: "c-sewage",
    costTypeId: "ct-sewage",
    allocationKey: "per_consumption_m3",
    name: "Schmutzwasser",
    amountCents: 75_000, // 750 EUR
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  };

  // Müll nach Personen
  const garbageCost: CostEntry = {
    id: "c-garbage",
    costTypeId: "ct-garbage",
    allocationKey: "per_person",
    name: "Müllgebühr",
    amountCents: 36_000, // 360 EUR -> 120 pro Person
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  };

  // Gebäudeversicherung nach qm
  const insuranceCost: CostEntry = {
    id: "c-insurance",
    costTypeId: "ct-insurance",
    allocationKey: "per_living_area",
    name: "Gebäudeversicherung",
    amountCents: 80_000, // 800 EUR / 200 qm = 4 pro qm
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  };

  // Schornsteinfeger pro Wohnung
  const chimneyCost: CostEntry = {
    id: "c-chimney",
    costTypeId: "ct-chimney",
    allocationKey: "per_unit",
    name: "Schornsteinfeger",
    amountCents: 10_000, // 100 EUR
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  };

  // TV/Internet Pauschale 15 EUR/Monat = 180 EUR/Jahr NUR für Mieter1
  const _tvCost: CostEntry = {
    id: "c-tv",
    costTypeId: "ct-tv",
    allocationKey: "fixed",
    name: "TV/Internet Pauschale",
    amountCents: 18_000, // 180 EUR
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
  };

  // Wärmemengenzähler: Jede Wohnung hat einen (direkte kWh-Messung).
  const consumptionMeters = [
    {
      meter: meter("wmz-eg", "heat_meter", "unit", "u-eg", "WMZ EG", {
        measurementUnit: "kwh",
      }),
      readings: [reading("2025-01-01", 0), reading("2025-12-31", 100)],
    },
    {
      meter: meter("wmz-og", "heat_meter", "unit", "u-og", "WMZ OG", {
        measurementUnit: "kwh",
      }),
      readings: [reading("2025-01-01", 0), reading("2025-12-31", 150)],
    },
  ];

  // Wasser: Haupt, OG-Wohnung, Gartenwasser OG (parallel zum OG-Abgang),
  // EG als expliziter Differenzzähler.
  const waterMeters = [
    {
      meter: meter("w-main", "water_cold", "main", null, "Hauptzähler Keller"),
      readings: [reading("2025-01-01", 1000), reading("2025-12-31", 1200)],
    },
    {
      meter: meter("w-og", "water_cold", "unit", "u-og", "OG Wohnung"),
      readings: [reading("2025-01-01", 500), reading("2025-12-31", 600)],
    },
    {
      meter: meter(
        "w-garten",
        "water_cold",
        "common",
        "u-og",
        "Gartenwasser OG",
      ),
      readings: [reading("2025-01-01", 100), reading("2025-12-31", 130)],
    },
    {
      meter: meter(
        "w-eg-diff",
        "water_cold",
        "virtual_difference",
        "u-eg",
        "EG (Differenz)",
      ),
      readings: [],
      differenceConfig: {
        baseMeterId: "w-main",
        subtractedMeterIds: ["w-og", "w-garten"],
      },
    },
  ];
  // Gesamt: 200, OG direkt: 100, Gartenwasser OG: 30 -> OG zusammen 130, EG (Differenz): 70

  const buildInput = (
    targetUnitId: string,
    targetTenantId: string,
  ): StatementCalculationInput => {
    const period = { start: periodStart, end: periodEnd };
    const heatingCostTypes = [
      { name: "Gas", costs: [gasCost] },
      { name: "Hilfsstrom Therme", costs: [heatingElectricityCost] },
    ];
    const totalHeatingCostsCents = heatingCostTypes.reduce(
      (acc, ct) => acc + aggregateCostsForPeriod(ct.costs, period),
      0,
    );
    const heatingDetail = calculateHeating({
      totalHeatingCostsCents,
      config: { consumptionShareBps: 7000 },
      units,
      consumptionMethod: "heat_meter",
      consumptionMeters,
      periodStart,
      periodEnd,
    });
    return {
      period,
      units,
      targetTenantId,
      targetUnitId,
      costTypes: [
        {
          id: "ct-gas",
          name: "Gas",
          allocationKey: "heating_ordinance",
          costs: [gasCost],
        },
        {
          id: "ct-strom",
          name: "Hilfsstrom Therme",
          allocationKey: "heating_ordinance",
          costs: [heatingElectricityCost],
        },
        {
          id: "ct-water",
          name: "Frischwasser",
          allocationKey: "per_consumption_m3",
          costs: [waterCost],
        },
        {
          id: "ct-sewage",
          name: "Schmutzwasser",
          allocationKey: "per_consumption_m3",
          costs: [sewageCost],
        },
        {
          id: "ct-garbage",
          name: "Müllgebühr",
          allocationKey: "per_person",
          costs: [garbageCost],
        },
        {
          id: "ct-insurance",
          name: "Gebäudeversicherung",
          allocationKey: "per_living_area",
          costs: [insuranceCost],
        },
        {
          id: "ct-chimney",
          name: "Schornsteinfeger",
          allocationKey: "per_unit",
          costs: [chimneyCost],
        },
        // TV/Internet nur für Mieter1: Caller muss selektieren.
        // In diesem Test: fügen es NUR bei Mieter1's Abrechnung hinzu.
      ],
      waterMeters,
      heatingDetail,
      totalAdvancesCents: 0,
    };
  };

  it("Gas-Rechnung wird tagesgenau auf 2025 zugeordnet", () => {
    const input = buildInput("u-eg", "t-mieter1");
    const result = calculateStatement(input);

    // Gas-Anteil 2025: 31.12.2025 − 01.01.2025 = 212 Tage von 2024-08-01 - 2025-07-31
    // (Januar bis Juli = 212 Tage)
    // 365000 x (212/365) = 211.917
    // Der Rest fällt in den Januar-Juli-Zeitraum des Abrechnungsjahres
    // Hilfsstrom ist voll drin: 10000
    // Gesamt-Heizkosten: 211917 + 10000 = 221917

    const line = result.lines.find((l) => l.costTypeName === "Heizkosten");
    expect(line).toBeDefined();
    // Erlaube kleine Toleranz wegen Cent-Rundung
    expect(line?.totalAmountCents).toBeGreaterThan(221_000);
    expect(line?.totalAmountCents).toBeLessThan(222_500);
  });

  it("EG-Wohnung bekommt Wasser-Differenzanteil korrekt zugeteilt", () => {
    const input = buildInput("u-eg", "t-mieter1");
    const result = calculateStatement(input);

    // Gesamt 200 m3, OG 130 m3, EG 70 m3 (Differenz)
    // Wasseranteil EG: 500 * 70/200 = 175 EUR = 17500 Cent
    const waterLine = result.lines.find(
      (l) => l.costTypeName === "Frischwasser",
    );
    expect(waterLine?.tenantAmountCents).toBe(17_500);
    expect(waterLine?.shareBps).toBe(3500);

    // Schmutzwasser gleicher Prozentsatz: 750 * 0.35 = 262.50
    const sewageLine = result.lines.find(
      (l) => l.costTypeName === "Schmutzwasser",
    );
    expect(sewageLine?.tenantAmountCents).toBe(26_250);
  });

  it("OG-Wohnung bekommt Wasser-Mehranteil (Wohnung + Gartenwasser)", () => {
    const input = buildInput("u-og", "t-mieter2");
    const result = calculateStatement(input);

    // OG: 100 direkt + 30 Gartenwasser = 130 von 200 = 65%
    const waterLine = result.lines.find(
      (l) => l.costTypeName === "Frischwasser",
    );
    expect(waterLine?.tenantAmountCents).toBe(32_500);
  });

  it("Müllgebühr nach Personen verteilt (1 + 2 = 3)", () => {
    const inputEg = buildInput("u-eg", "t-mieter1");
    const resultEg = calculateStatement(inputEg);
    const inputOg = buildInput("u-og", "t-mieter2");
    const resultOg = calculateStatement(inputOg);

    const egLine = resultEg.lines.find((l) => l.costTypeName === "Müllgebühr");
    const ogLine = resultOg.lines.find((l) => l.costTypeName === "Müllgebühr");
    if (!egLine || !ogLine) {
      throw new Error("Müllgebühr-Zeile fehlt");
    }

    // 360 EUR / 3 Personen = 120 pro Person
    expect(egLine.tenantAmountCents).toBe(12_000);
    expect(ogLine.tenantAmountCents).toBe(24_000);
    // Summe muss exakt der Gesamtkosten entsprechen
    expect(egLine.tenantAmountCents + ogLine.tenantAmountCents).toBe(36_000);
  });

  it("Versicherung nach qm verteilt (80 + 120 = 200)", () => {
    const inputEg = buildInput("u-eg", "t-mieter1");
    const resultEg = calculateStatement(inputEg);
    const inputOg = buildInput("u-og", "t-mieter2");
    const resultOg = calculateStatement(inputOg);

    const egLine = resultEg.lines.find(
      (l) => l.costTypeName === "Gebäudeversicherung",
    );
    const ogLine = resultOg.lines.find(
      (l) => l.costTypeName === "Gebäudeversicherung",
    );
    if (!egLine || !ogLine) {
      throw new Error("Gebäudeversicherung-Zeile fehlt");
    }

    // 800 EUR / 200 qm = 4 EUR pro qm
    expect(egLine.tenantAmountCents).toBe(32_000);
    expect(ogLine.tenantAmountCents).toBe(48_000);
    expect(egLine.tenantAmountCents + ogLine.tenantAmountCents).toBe(80_000);
  });

  it("Schornsteinfeger pro Wohnung 50/50", () => {
    const inputEg = buildInput("u-eg", "t-mieter1");
    const resultEg = calculateStatement(inputEg);
    const inputOg = buildInput("u-og", "t-mieter2");
    const resultOg = calculateStatement(inputOg);

    const egLine = resultEg.lines.find(
      (l) => l.costTypeName === "Schornsteinfeger",
    );
    const ogLine = resultOg.lines.find(
      (l) => l.costTypeName === "Schornsteinfeger",
    );

    expect(egLine?.tenantAmountCents).toBe(5000);
    expect(ogLine?.tenantAmountCents).toBe(5000);
  });

  it("HeizkostenV: OG (mehr Verbrauch + mehr qm) zahlt mehr", () => {
    const inputEg = buildInput("u-eg", "t-mieter1");
    const resultEg = calculateStatement(inputEg);
    const inputOg = buildInput("u-og", "t-mieter2");
    const resultOg = calculateStatement(inputOg);

    const egHeating = resultEg.lines.find(
      (l) => l.costTypeName === "Heizkosten",
    );
    const ogHeating = resultOg.lines.find(
      (l) => l.costTypeName === "Heizkosten",
    );
    if (!egHeating || !ogHeating) {
      throw new Error("Heizkosten-Zeile fehlt");
    }

    // WMZ: EG 100 kWh, OG 150 kWh -> 40 %/60 % Verbrauchsanteil
    // qm: EG 80, OG 120 -> 40 %/60 % Grundkostenanteil
    // Also bei gleicher Verteilung: OG zahlt 60 %, EG 40 %
    expect(ogHeating.tenantAmountCents).toBeGreaterThan(
      egHeating.tenantAmountCents,
    );
    // Summe muss den gesamten Heizkosten entsprechen
    const total = egHeating.tenantAmountCents + ogHeating.tenantAmountCents;
    expect(total).toBe(egHeating.totalAmountCents);
  });

  it("Saldo: Wenn Tenant weniger bezahlt als Kosten, gibt es Nachzahlung", () => {
    const input = buildInput("u-eg", "t-mieter1");
    const withAdvances: StatementCalculationInput = {
      ...input,
      totalAdvancesCents: 10_000, // 100 EUR Vorauszahlung
    };
    const result = calculateStatement(withAdvances);

    expect(result.totalAdvancesCents).toBe(10_000);
    expect(result.balanceCents).toBe(result.totalCostsCents - 10_000);
  });

  // Mietzeitanteilige Abrechnung: Wenn ein Mieter erst innerhalb der NK-Periode
  // einzieht, ist Bezug für die Umlage die VOLLE Statement-Periode - nicht
  // die Mieter-Schnittmenge. Das bedeutet:
  //   - `totalAmountCents` ist die volle Jahresrechnung (kein Vorab-Kürzen),
  //   - `daysTotal` zeigt 365, `daysTenant` die Mieter-Tage (z. B. 275),
  //   - der Mieter-Anteil ergibt sich aus tenantBase / totalBase, wobei
  //     tenantBase die Mieter-Tage einschließt (z. B. areaSqm x 275),
  //   - die Differenz zur vollen Periode der Ziel-Wohnung fällt dem
  //     Vermieter zu (Leerstand außerhalb Mietzeit).
  // Der API-Service bildet die unterschiedliche Tages-Sicht (Ziel-Wohnung
  // = Mieter-Tage, andere Wohnungen = volle Periode) im `units`-Array ab.
  it("Mietzeitanteilig: Mieter zieht 01.04. ein -> 275/365 Tage", () => {
    const effectivePeriod = { start: "2025-04-01", end: "2025-12-31" };
    const period = { start: periodStart, end: periodEnd };
    const tenantDays = 275;
    const fullDays = 365;

    // Ziel-Wohnung (Mieter1) trägt die Mieter-Tage; OG (Mieter2) bleibt
    // ganzjährig - analog zum service-seitigen Mapping in `calculate()`.
    const unitsApril: UnitInfo[] = [
      {
        ...unitEg,
        personDays: tenantDays,
        occupiedDays: tenantDays,
        periodDays: fullDays,
      },
      unitOg,
    ];

    // Heizung pre-computed: Gesamtkosten auf volle Statement-Periode,
    // Verbrauchszähler der Ziel-Wohnung über die Mieter-Periode.
    const heatingCostTypes = [
      { name: "Gas", costs: [gasCost] },
      { name: "Hilfsstrom Therme", costs: [heatingElectricityCost] },
    ];
    const totalHeatingCostsCents = heatingCostTypes.reduce(
      (acc, ct) => acc + aggregateCostsForPeriod(ct.costs, period),
      0,
    );
    const heatingDetail = calculateHeating({
      totalHeatingCostsCents,
      config: { consumptionShareBps: 7000 },
      units: unitsApril,
      consumptionMethod: "heat_meter",
      consumptionMeters,
      periodStart,
      periodEnd,
      tenantPeriodStart: effectivePeriod.start,
      tenantPeriodEnd: effectivePeriod.end,
      targetUnitId: "u-eg",
    });

    const input: StatementCalculationInput = {
      period,
      tenantPeriod: effectivePeriod,
      units: unitsApril,
      targetTenantId: "t-mieter1",
      targetUnitId: "u-eg",
      costTypes: [
        {
          id: "ct-garbage",
          name: "Müllgebühr",
          allocationKey: "per_person",
          costs: [garbageCost],
        },
        {
          id: "ct-insurance",
          name: "Gebäudeversicherung",
          allocationKey: "per_living_area",
          costs: [insuranceCost],
        },
        {
          id: "ct-chimney",
          name: "Schornsteinfeger",
          allocationKey: "per_unit",
          costs: [chimneyCost],
        },
      ],
      waterMeters,
      heatingDetail,
      totalAdvancesCents: 0,
    };
    const result = calculateStatement(input);

    // Müll (per_person, mit Vermieter-Basis-Person bei Leerstand):
    // Mieter1 1x275 = 275, Mieter2 2x365 = 730, Summe Mieter = 1005. Leerstand
    // = 2x365 − (275 + 365) = 90 Tage -> Vermieter 1x90 = 90 Personentage.
    // totalBase = 1005 + 90 = 1095. 36 000 x 275/1095 ~= 9 041.
    const garbage = result.lines.find((l) => l.costTypeName === "Müllgebühr");
    expect(garbage?.totalAmountCents).toBe(36_000);
    expect(garbage?.tenantAmountCents).toBeCloseTo(9041, 0);
    expect(garbage?.landlordAmountCents).toBeCloseTo(2959, 0);

    // Versicherung (per_living_area, mit Vermieter-Leerstand): Mieter1
    // 80x275 = 22 000, Mieter2 120x365 = 43 800. maxBase = 200x365 =
    // 73 000. Vermieter trägt 73 000 − 65 800 = 7 200. Mieter1: 80 000 x
    // 22 000/73 000 ~= 24 110.
    const insurance = result.lines.find(
      (l) => l.costTypeName === "Gebäudeversicherung",
    );
    expect(insurance?.totalAmountCents).toBe(80_000);
    expect(insurance?.tenantAmountCents).toBeCloseTo(24_110, 0);
    expect(insurance?.daysTotal).toBe(fullDays);
    expect(insurance?.daysTenant).toBe(tenantDays);
    expect(insurance?.landlordAmountCents).toBeCloseTo(7890, 0);

    // Schornsteinfeger (per_unit): Mieter1 275 Tage, Mieter2 365 Tage,
    // maxBase = 2x365 = 730. Mieter1: 10 000 x 275/730 ~= 3 767.
    const chimney = result.lines.find(
      (l) => l.costTypeName === "Schornsteinfeger",
    );
    expect(chimney?.totalAmountCents).toBe(10_000);
    expect(chimney?.tenantAmountCents).toBeCloseTo(3767, 0);
    expect(chimney?.daysTotal).toBe(fullDays);
    expect(chimney?.daysTenant).toBe(tenantDays);
  });

  // Issue 1: Wenn der Wohnungs-Wasserzähler erst zum Einzugsdatum installiert
  // wurde und der erste Stand vom Einzugstag ist, darf die Berechnung der
  // Wasser-Allokation nicht mit "Extrapolation nicht erlaubt" abbrechen.
  // Voraussetzung: `tenantPeriod` läuft nur über die Mietzeit, sodass Zähler-
  // ablesungen nicht außerhalb des Vertrags interpoliert werden.
  it("Mietzeitanteilig: Zähler nur innerhalb Mietzeit -> keine Extrapolation", () => {
    const effectivePeriod = { start: "2025-04-01", end: "2025-12-31" };
    const period = { start: periodStart, end: periodEnd };

    // Wasser-Setup analog zum E2E-Setup, aber OG-Zähler hat erst ab 01.04.
    // einen Stand. Hauptzähler hat seine üblichen Jahres-Eckpunkte und wird
    // tagesgenau interpoliert.
    const waterMetersPartial = [
      {
        meter: meter(
          "w-main",
          "water_cold",
          "main",
          null,
          "Hauptzähler Keller",
        ),
        readings: [reading("2025-01-01", 1000), reading("2025-12-31", 1200)],
      },
      {
        meter: meter("w-og", "water_cold", "unit", "u-og", "OG Wohnung"),
        readings: [reading("2025-04-01", 500), reading("2025-12-31", 575)],
      },
      {
        meter: meter(
          "w-garten",
          "water_cold",
          "common",
          "u-og",
          "Gartenwasser OG",
        ),
        readings: [reading("2025-04-01", 100), reading("2025-12-31", 122)],
      },
      {
        meter: meter(
          "w-eg-diff",
          "water_cold",
          "virtual_difference",
          "u-eg",
          "EG (Differenz)",
        ),
        readings: [],
        differenceConfig: {
          baseMeterId: "w-main",
          subtractedMeterIds: ["w-og", "w-garten"],
        },
      },
    ];

    const heatingDetail = calculateHeating({
      totalHeatingCostsCents: 0,
      config: { consumptionShareBps: 7000 },
      units,
      consumptionMethod: "heat_meter",
      consumptionMeters: [],
      periodStart,
      periodEnd,
      tenantPeriodStart: effectivePeriod.start,
      tenantPeriodEnd: effectivePeriod.end,
      targetUnitId: "u-eg",
    });

    const input: StatementCalculationInput = {
      period,
      tenantPeriod: effectivePeriod,
      units,
      targetTenantId: "t-mieter1",
      targetUnitId: "u-eg",
      costTypes: [
        {
          id: "ct-water",
          name: "Frischwasser",
          allocationKey: "per_consumption_m3",
          costs: [waterCost],
        },
      ],
      waterMeters: waterMetersPartial,
      heatingDetail,
      totalAdvancesCents: 0,
    };

    expect(() => calculateStatement(input)).not.toThrow();
  });

  // Bei unterjährigem Mietverhältnis darf die Verbrauchs-Quote
  // der Mietzeit nicht auf die Jahres-Kosten angewendet werden. Nenner läuft
  // über die volle Periode, nur die Ziel-Wohnung wird auf die Mietzeit
  // geklemmt; ihr Rest-Verbrauch fällt auf den Vermieter.
  it("Wasser bei Mieterwechsel: Jahresmengen-Quote statt Raten-Quote, Summen-Invariante", () => {
    const period = { start: periodStart, end: periodEnd };

    // Konstanter Verbrauch: EG und OG je 73 m3/Jahr (0,2 m3/Tag), Haupt 146.
    const waterMetersLinear = [
      {
        meter: meter(
          "w-main",
          "water_cold",
          "main",
          null,
          "Hauptzähler Keller",
        ),
        readings: [reading("2025-01-01", 0), reading("2025-12-31", 146)],
      },
      {
        meter: meter("w-eg", "water_cold", "unit", "u-eg", "EG Wohnung"),
        readings: [reading("2025-01-01", 0), reading("2025-12-31", 73)],
      },
      {
        meter: meter("w-og", "water_cold", "unit", "u-og", "OG Wohnung"),
        readings: [reading("2025-01-01", 0), reading("2025-12-31", 73)],
      },
    ];

    const emptyHeating = calculateHeating({
      totalHeatingCostsCents: 0,
      config: { consumptionShareBps: 7000 },
      units,
      consumptionMethod: "heat_meter",
      consumptionMeters: [],
      periodStart,
      periodEnd,
    });

    const buildWaterInput = (
      targetUnitId: string,
      targetTenantId: string,
      tenantPeriod: { start: string; end: string } | undefined,
      occupiedDaysEg: number,
    ): StatementCalculationInput => ({
      period,
      tenantPeriod,
      units: [
        {
          ...unitEg,
          personDays: occupiedDaysEg,
          occupiedDays: occupiedDaysEg,
          periodDays: PERIOD_DAYS_2025,
        },
        unitOg,
      ],
      targetTenantId,
      targetUnitId,
      costTypes: [
        {
          id: "ct-water",
          name: "Frischwasser",
          allocationKey: "per_consumption_m3",
          costs: [{ ...waterCost, amountCents: 60_000 }],
        },
      ],
      waterMeters: waterMetersLinear,
      heatingDetail: emptyHeating,
      totalAdvancesCents: 0,
    });

    // Mieter A: EG 01.01.-30.06. Sein Verbrauch (~36,1 m3) ist ~25 % des
    // Jahresverbrauchs (146 m3) -> ~150 EUR, nicht 50 % (300 EUR, alter Bug).
    const statementA = calculateStatement(
      buildWaterInput(
        "u-eg",
        "t-mieter-a",
        { start: "2025-01-01", end: "2025-06-30" },
        181,
      ),
    );
    const waterA = statementA.lines.find(
      (l) => l.costTypeName === "Frischwasser",
    );
    expect(statementA.waterDetail?.totalConsumptionM3).toBe(146);
    expect(statementA.waterDetail?.landlordConsumptionM3).toBeCloseTo(36.9, 1);
    expect(waterA?.tenantAmountCents).toBeCloseTo(14_835, 0);
    // Rest-Verbrauch der EG (Nachmieter) als Vermieteranteil in A's Statement.
    expect(waterA?.landlordAmountCents).toBeCloseTo(15_165, 0);
    // Zeile bilanziert: Mieter + OG-Anteil + Vermieter = Gesamtkosten.
    expect(
      (waterA?.tenantAmountCents ?? 0) + (waterA?.landlordAmountCents ?? 0),
    ).toBeCloseTo(30_000, 0);

    // Nachmieter B: EG 01.07.-31.12.
    const statementB = calculateStatement(
      buildWaterInput(
        "u-eg",
        "t-mieter-b",
        { start: "2025-07-01", end: "2025-12-31" },
        184,
      ),
    );
    const waterB = statementB.lines.find(
      (l) => l.costTypeName === "Frischwasser",
    );
    expect(waterB?.tenantAmountCents).toBeCloseTo(15_082, 0);

    // OG-Mieter: ganzjährig, keine Klemmung -> exakt 50 %.
    const statementOg = calculateStatement(
      buildWaterInput("u-og", "t-mieter2", undefined, PERIOD_DAYS_2025),
    );
    const waterOg = statementOg.lines.find(
      (l) => l.costTypeName === "Frischwasser",
    );
    expect(statementOg.waterDetail?.landlordConsumptionM3).toBe(0);
    expect(waterOg?.tenantAmountCents).toBe(30_000);

    // Summen-Invariante: Alle Mieter-Anteile zusammen überschreiten die
    // Jahres-Kosten nicht. Die kleine Lücke (~83 Cent) ist der nicht
    // zugerechnete Verbrauchs-Tag zwischen Auszug A und Einzug B (N2).
    const tenantSum =
      (waterA?.tenantAmountCents ?? 0) +
      (waterB?.tenantAmountCents ?? 0) +
      (waterOg?.tenantAmountCents ?? 0);
    expect(tenantSum).toBeLessThanOrEqual(60_000);
    expect(tenantSum).toBeGreaterThan(59_800);
  });
});
