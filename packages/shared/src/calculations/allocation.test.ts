import { describe, expect, it } from "vitest";
import type { CostEntry, UnitInfo, WaterDetail } from "../types/index.js";
import { aggregateCostsForPeriod, allocateCost } from "./allocation.js";

// Test-Period: 365 Tage. Beide Wohnungen ganzjährig vermietet - d. h.
// Personentage / Flächentage entsprechen der Snapshot-Verteilung (kein
// Vermieter-Anteil), so dass Erwartungswerte wie bei einfacher
// Snapshot-Verteilung gelten.
const PERIOD_DAYS = 365;

const unitEg: UnitInfo = {
  id: "unit-eg",
  name: "EG",
  areaSqm: 80,
  occupantCount: 1,
  personDays: PERIOD_DAYS,
  occupiedDays: PERIOD_DAYS,
  periodDays: PERIOD_DAYS,
};

const unitOg: UnitInfo = {
  id: "unit-og",
  name: "OG/DG",
  areaSqm: 120,
  occupantCount: 2,
  personDays: 2 * PERIOD_DAYS,
  occupiedDays: PERIOD_DAYS,
  periodDays: PERIOD_DAYS,
};

const units = [unitEg, unitOg];

describe("aggregateCostsForPeriod", () => {
  it("voller Überlapp addiert alle Rechnungen", () => {
    const costs: CostEntry[] = [
      {
        id: "c1",
        costTypeId: "ct1",
        allocationKey: "per_living_area",
        name: "Müll",
        amountCents: 10_000,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
      {
        id: "c2",
        costTypeId: "ct1",
        allocationKey: "per_living_area",
        name: "Müll",
        amountCents: 5000,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
    ];
    expect(
      aggregateCostsForPeriod(costs, {
        start: "2025-01-01",
        end: "2025-12-31",
      }),
    ).toBe(15_000);
  });

  it("Rechnung über Jahresgrenze wird anteilig zugerechnet", () => {
    const costs: CostEntry[] = [
      {
        id: "c1",
        costTypeId: "ct1",
        allocationKey: "heating_ordinance",
        name: "Gas",
        amountCents: 365_000, // 1000 Cent pro Tag
        periodStart: "2024-08-01",
        periodEnd: "2025-07-31",
      },
    ];
    // Abrechnung 01.01.2025 - 31.12.2025, Overlap: 212 Tage von 365 = 0,5808
    const result = aggregateCostsForPeriod(costs, {
      start: "2025-01-01",
      end: "2025-12-31",
    });
    expect(result).toBeGreaterThan(211_000);
    expect(result).toBeLessThan(213_000);
  });
});

describe("allocateCost per_living_area", () => {
  it("verteilt nach Flächentagen (alle ganzjährig -> kein Vermieter-Anteil)", () => {
    const result = allocateCost("Gebäudereinigung", "per_living_area", 10_000, {
      units,
      targetUnitId: "unit-eg",
    });
    // EG: 80/200 = 40 %, 10000 x 0,4 = 4000
    expect(result.tenantAmountCents).toBe(4000);
    expect(result.shareBps).toBe(4000);
    expect(result.totalBase).toBe(200 * PERIOD_DAYS); // m² x Tage
    expect(result.tenantBase).toBe(80 * PERIOD_DAYS);
    expect(result.landlordAmountCents).toBe(0);
    expect(result.landlordShareBps).toBe(0);
  });

  it("zeitanteilig: EG zieht 01.04. ein, OG ganzjährig -> Vermieter-Anteil für EG-Leerstand", () => {
    // EG bewohnt 01.04.-31.12. = 275 Tage; OG ganzjährig 365 Tage
    const unitEgPartial: UnitInfo = {
      ...unitEg,
      personDays: 275,
      occupiedDays: 275,
    };
    const partialUnits = [unitEgPartial, unitOg];
    const result = allocateCost("Gebäudereinigung", "per_living_area", 10_000, {
      units: partialUnits,
      targetUnitId: "unit-eg",
    });
    // maxBase = (80+120) x 365 = 73000
    // EG-Weight  = 80  x 275 = 22000
    // OG-Weight  = 120 x 365 = 43800
    // Summe Mieter   = 65800; Vermieter = 73000 - 65800 = 7200
    // EG-Anteil  = 22000/73000 ~= 30,14 % -> 3014 ct
    // Vermieter  = 7200/73000  ~=  9,86 % -> ca. 986 ct
    expect(result.totalBase).toBe(73_000);
    expect(result.tenantBase).toBe(22_000);
    expect(result.tenantAmountCents).toBeCloseTo(3014, 0);
    expect(result.landlordAmountCents).toBeCloseTo(986, 0);
    expect(result.shareBps).toBe(3014);
    expect(result.landlordShareBps).toBe(986);
  });
});

describe("allocateCost per_heating_area", () => {
  it("fällt ohne heatingAreaSqm auf Wohnfläche zurück", () => {
    const result = allocateCost("Wartung Heizung", "per_heating_area", 10_000, {
      units,
      targetUnitId: "unit-eg",
    });
    // Ohne heatingAreaSqm -> fallback auf areaSqm: 80/200 = 40 %
    expect(result.tenantAmountCents).toBe(4000);
    expect(result.shareBps).toBe(4000);
    expect(result.totalBase).toBe(200);
    expect(result.tenantBase).toBe(80);
  });

  it("nutzt heatingAreaSqm wenn gesetzt", () => {
    const unitsWithHeating: UnitInfo[] = [
      { ...unitEg, heatingAreaSqm: 60 },
      { ...unitOg, heatingAreaSqm: 90 },
    ];
    const result = allocateCost("Wartung Heizung", "per_heating_area", 10_000, {
      units: unitsWithHeating,
      targetUnitId: "unit-eg",
    });
    // EG: 60/150 = 40 %
    expect(result.tenantAmountCents).toBe(4000);
    expect(result.totalBase).toBe(150);
    expect(result.tenantBase).toBe(60);
  });
});

describe("allocateCost per_person", () => {
  it("verteilt nach Personentagen (alle ganzjährig -> 1/3)", () => {
    const result = allocateCost("Müll", "per_person", 3000, {
      units,
      targetUnitId: "unit-eg",
    });
    // EG: 365 / (365+730) = 1/3 -> 1000
    expect(result.tenantAmountCents).toBe(1000);
    expect(result.landlordAmountCents).toBe(0);
  });

  it("Personentage: EG ganzjährig, OG zieht Mitte Mai ein -> EG zahlt mehr", () => {
    // EG: 1 Person x 365 = 365 Pt; OG: 1 Person x 232 = 232 Pt
    const unitEgFull: UnitInfo = { ...unitEg, personDays: 365 };
    const unitOgPartial: UnitInfo = {
      ...unitOg,
      occupantCount: 1,
      personDays: 232,
    };
    const result = allocateCost("Müll", "per_person", 1000, {
      units: [unitEgFull, unitOgPartial],
      targetUnitId: "unit-eg",
    });
    // 365 / 597 x 1000 = 611 (gerundet). Beide Wohnungen sind voll
    // occupiedDays=365 -> kein Leerstand, kein Vermieter-Personentage.
    expect(result.tenantAmountCents).toBeCloseTo(611, 0);
    expect(result.landlordAmountCents).toBe(0);
  });
});

describe("allocateCost per_unit", () => {
  it("verteilt pro Wohnungstag (alle ganzjährig -> 50/50)", () => {
    const result = allocateCost("Schornsteinfeger", "per_unit", 10_000, {
      units,
      targetUnitId: "unit-eg",
    });
    expect(result.tenantAmountCents).toBe(5000);
    expect(result.landlordAmountCents).toBe(0);
  });
});

describe("allocateCost per_consumption_m3", () => {
  it("verteilt nach Wasserverbrauch", () => {
    const waterDetail: WaterDetail = {
      totalConsumptionM3: 200,
      perUnit: [
        {
          unitId: "unit-eg",
          unitName: "EG",
          consumptionM3: 70,
          sharePct: 35,
          isDifferential: true,
          meterContributions: [],
        },
        {
          unitId: "unit-og",
          unitName: "OG/DG",
          consumptionM3: 130,
          sharePct: 65,
          isDifferential: false,
          meterContributions: [],
        },
      ],
    };
    const result = allocateCost("Wasser", "per_consumption_m3", 10_000, {
      units,
      targetUnitId: "unit-eg",
      waterDetail,
    });
    expect(result.tenantAmountCents).toBe(3500); // 70/200 = 35 %
  });

  it("wirft ohne waterDetail", () => {
    expect(() =>
      allocateCost("Wasser", "per_consumption_m3", 10_000, {
        units,
        targetUnitId: "unit-eg",
      }),
    ).toThrow(/waterDetail/u);
  });
});

describe("allocateCost per_consumption_kwh", () => {
  it("ist noch nicht implementiert und wirft", () => {
    expect(() =>
      allocateCost("Allgemeinstrom", "per_consumption_kwh", 10_000, {
        units,
        targetUnitId: "unit-eg",
      }),
    ).toThrow(/allocationKwhNotImplemented/u);
  });
});

describe("allocateCost fixed", () => {
  it("gibt vollen Betrag an Target-Tenant", () => {
    const result = allocateCost("TV/Internet", "fixed", 18_000, {
      units,
      targetUnitId: "unit-eg",
    });
    expect(result.tenantAmountCents).toBe(18_000);
    expect(result.shareBps).toBe(10_000);
  });
});
