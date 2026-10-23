import { describe, expect, it } from "vitest";
import {
  advanceValidFromMonthOptions,
  inferTariffAdjustmentBpsFromInvoices,
  isAdvanceValidFromRetroactive,
  STATEMENT_HEATING_COST_TYPE_ID,
  suggestAdvanceValidFromDate,
  suggestNextMonthlyAdvanceCents,
  suggestNextMonthlyAdvanceCentsWithTariffs,
  type TariffInferenceItem,
} from "./advance.js";

describe("advanceValidFromMonthOptions", () => {
  const isoOf = (documentDate: string, today: string) =>
    advanceValidFromMonthOptions(documentDate, today).map(
      (option) => option.iso,
    );

  it("deckt bei einer heute ausgestellten Abrechnung vier Monate ab", () => {
    expect(isoOf("2026-09-20", "2026-09-20")).toEqual([
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
    ]);
  });

  it("spannt bei einer rückdatierten Abrechnung vom Brief bis über heute", () => {
    expect(isoOf("2026-05-15", "2026-09-20")).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
    ]);
  });

  it("spannt bei einer vordatierten Abrechnung von heute bis über den Brief", () => {
    expect(isoOf("2026-12-01", "2026-09-20")).toEqual([
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
      "2027-03-01",
    ]);
  });

  it("beschriftet die Optionen mit dem vollen Datum, wie es im Brief steht", () => {
    expect(advanceValidFromMonthOptions("2026-09-20", "2026-09-20")[0]).toEqual(
      { iso: "2026-09-01", label: "01.09.2026" },
    );
  });
});

describe("isAdvanceValidFromRetroactive", () => {
  it("lässt einen Stichtag ab dem Dokumentdatum zu", () => {
    expect(isAdvanceValidFromRetroactive("2026-10-01", "2026-09-19")).toBe(
      false,
    );
    expect(isAdvanceValidFromRetroactive("2026-09-19", "2026-09-19")).toBe(
      false,
    );
  });

  it("weist einen Stichtag vor dem Dokumentdatum zurück", () => {
    expect(isAdvanceValidFromRetroactive("2026-06-01", "2026-09-19")).toBe(
      true,
    );
    // Auch derselbe Monat zählt, wenn der Erste vor dem Brief liegt.
    expect(isAdvanceValidFromRetroactive("2026-09-01", "2026-09-19")).toBe(
      true,
    );
  });
});

describe("suggestNextMonthlyAdvanceCents", () => {
  it("lässt eine volle Schaltjahres-Periode unverändert", () => {
    // 1.446 € über 366 Tage = 120,50 €/Monat -> aufgerundet 121 €.
    // Mit fest 365 Bezugstagen schrumpft der Vorschlag auf 120,17 € und
    // damit auf 120 €.
    expect(suggestNextMonthlyAdvanceCents(144_600, 366, 366)).toBe(12_100);
    expect(suggestNextMonthlyAdvanceCents(144_600, 366)).toBe(12_000);
  });
});

describe("suggestNextMonthlyAdvanceCentsWithTariffs", () => {
  const lines = { water: 120_000, heating: 60_000 };

  it("entspricht ohne Anpassungen dem einfachen Vorschlag", () => {
    // 1.800 EUR im Jahr = 150 EUR im Monat
    expect(suggestNextMonthlyAdvanceCentsWithTariffs(lines, 365, null)).toBe(
      15_000,
    );
    expect(suggestNextMonthlyAdvanceCentsWithTariffs(lines, 365, {})).toBe(
      15_000,
    );
  });

  it("schlägt den Tarif nur auf die genannte Kostenart auf", () => {
    // Heizung +10 %: 1.200 + 660 = 1.860 EUR im Jahr = 155 EUR im Monat
    expect(
      suggestNextMonthlyAdvanceCentsWithTariffs(lines, 365, { heating: 1000 }),
    ).toBe(15_500);
  });

  it("rechnet eine Senkung und ignoriert unbekannte Kostenarten", () => {
    // Wasser -5 %: 1.140 + 600 = 1.740 EUR im Jahr = 145 EUR im Monat
    expect(
      suggestNextMonthlyAdvanceCentsWithTariffs(lines, 365, {
        water: -500,
        unknown: 5000,
      }),
    ).toBe(14_500);
  });

  it("rechnet eine Rumpfperiode aufs Jahr hoch", () => {
    // 73 Tage sind ein Fünftel des Jahres: 396 EUR x 5 = 1.980 EUR im Jahr
    expect(
      suggestNextMonthlyAdvanceCentsWithTariffs(
        { water: 24_000, heating: 12_000 },
        73,
        { water: 1000, heating: 1000 },
      ),
    ).toBe(16_500);
  });

  it("lässt eine volle Schaltjahres-Periode unverändert", () => {
    expect(
      suggestNextMonthlyAdvanceCentsWithTariffs(lines, 366, null, 366),
    ).toBe(15_000);
  });

  it("rundet auf volle Euro und gibt mindestens 1 EUR zurück", () => {
    // 1.000 EUR im Jahr = 83,33 EUR im Monat
    expect(
      suggestNextMonthlyAdvanceCentsWithTariffs({ water: 100_000 }, 365, null),
    ).toBe(8300);
    // 1.010 EUR im Jahr = 84,17 EUR im Monat
    expect(
      suggestNextMonthlyAdvanceCentsWithTariffs({ water: 100_000 }, 365, {
        water: 100,
      }),
    ).toBe(8400);
    expect(
      suggestNextMonthlyAdvanceCentsWithTariffs({ water: 100 }, 365, null),
    ).toBe(100);
    expect(suggestNextMonthlyAdvanceCentsWithTariffs(lines, 0, null)).toBe(100);
  });
});

describe("suggestAdvanceValidFromDate", () => {
  it("nimmt den Folgemonat, wenn bis Monatsende mindestens 14 Tage bleiben", () => {
    expect(suggestAdvanceValidFromDate("2025-06-10")).toBe("2025-07-01");
    // Genau 14 Tage bis zum 30.06.
    expect(suggestAdvanceValidFromDate("2025-06-16")).toBe("2025-07-01");
  });

  it("nimmt den übernächsten Monat, wenn weniger als 14 Tage bleiben", () => {
    expect(suggestAdvanceValidFromDate("2025-06-17")).toBe("2025-08-01");
    expect(suggestAdvanceValidFromDate("2025-06-30")).toBe("2025-08-01");
  });

  it("richtet sich nach der Länge des Monats", () => {
    expect(suggestAdvanceValidFromDate("2025-02-14")).toBe("2025-03-01");
    expect(suggestAdvanceValidFromDate("2025-02-15")).toBe("2025-04-01");
    // Im Schaltjahr bleiben am 15.02. noch 14 Tage
    expect(suggestAdvanceValidFromDate("2024-02-15")).toBe("2024-03-01");
  });

  it("geht über den Jahreswechsel", () => {
    expect(suggestAdvanceValidFromDate("2025-12-05")).toBe("2026-01-01");
    expect(suggestAdvanceValidFromDate("2025-12-20")).toBe("2026-02-01");
    expect(suggestAdvanceValidFromDate("2025-11-20")).toBe("2026-01-01");
  });

  it("nimmt eine andere Mindestfrist an", () => {
    expect(suggestAdvanceValidFromDate("2025-06-25", 5)).toBe("2025-07-01");
    expect(suggestAdvanceValidFromDate("2025-06-26", 5)).toBe("2025-08-01");
  });
});

const HEATING_PSEUDO_ID = STATEMENT_HEATING_COST_TYPE_ID;
const period2025 = { start: "2025-01-01", end: "2025-12-31" };
const period2026 = { start: "2026-01-01", end: "2026-12-31" };

describe("inferTariffAdjustmentBpsFromInvoices - Heizkosten-Bucket", () => {
  it("vermischt Gas-m3 und Hilfsstrom-kWh nicht", () => {
    const items: TariffInferenceItem[] = [
      // Gasverbrauch - Verbrauchspositionen
      {
        costTypeId: "gas",
        allocationKey: "heating_ordinance",
        amountCents: 101_695,
        unitPriceCents: 753,
        periodStart: "2025-01-01",
        periodEnd: "2025-04-15",
      },
      {
        costTypeId: "gas",
        allocationKey: "heating_ordinance",
        amountCents: 88_828,
        unitPriceCents: 753,
        periodStart: "2025-04-16",
        periodEnd: "2025-12-31",
      },
      {
        costTypeId: "gas",
        allocationKey: "heating_ordinance",
        amountCents: 80_620,
        unitPriceCents: 827,
        periodStart: "2026-01-01",
        periodEnd: "2026-04-15",
      },
      // Gasverbrauch - Grundpreise (pauschal)
      {
        costTypeId: "gas",
        allocationKey: "heating_ordinance",
        amountCents: 4141,
        unitPriceCents: null,
        periodStart: "2025-01-01",
        periodEnd: "2025-04-15",
      },
      {
        costTypeId: "gas",
        allocationKey: "heating_ordinance",
        amountCents: 10_253,
        unitPriceCents: null,
        periodStart: "2025-04-16",
        periodEnd: "2025-12-31",
      },
      {
        costTypeId: "gas",
        allocationKey: "heating_ordinance",
        amountCents: 4141,
        unitPriceCents: null,
        periodStart: "2026-01-01",
        periodEnd: "2026-04-15",
      },
      // Hilfsstrom Therme - deutlich anderer Einheitspreis (€/kWh)
      {
        costTypeId: "hilfsstrom",
        allocationKey: "heating_ordinance",
        amountCents: 6000,
        unitPriceCents: 2885,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
      {
        costTypeId: "hilfsstrom",
        allocationKey: "heating_ordinance",
        amountCents: 3194,
        unitPriceCents: 2995,
        periodStart: "2026-01-01",
        periodEnd: "2026-05-31",
      },
    ];

    const result = inferTariffAdjustmentBpsFromInvoices({
      items,
      currentPeriod: period2025,
      followUpPeriod: period2026,
      heatingPseudoId: HEATING_PSEUDO_ID,
    });

    const heatingBps = result[HEATING_PSEUDO_ID];
    expect(heatingBps).toBeDefined();
    // Realistische Tarif-Steigerung: Gas 7,53 -> 8,27 (+9,8 %), Hilfsstrom
    // 28,85 -> 29,95 (+3,8 %). Gewichtet ergibt das eine moderate einstellige
    // Prozent-Anpassung - keinesfalls die +267 %, die durch Bucket-Mixing
    // entstanden wären.
    expect(heatingBps).toBeGreaterThan(0);
    expect(heatingBps).toBeLessThan(2000);
  });

  it("bündelt mehrere Heizkostenarten unter heatingPseudoId", () => {
    const items: TariffInferenceItem[] = [
      {
        costTypeId: "gas",
        allocationKey: "heating_ordinance",
        amountCents: 100_000,
        unitPriceCents: 100,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
      {
        costTypeId: "gas",
        allocationKey: "heating_ordinance",
        amountCents: 110_000,
        unitPriceCents: 110,
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      },
    ];

    const result = inferTariffAdjustmentBpsFromInvoices({
      items,
      currentPeriod: period2025,
      followUpPeriod: period2026,
      heatingPseudoId: HEATING_PSEUDO_ID,
    });

    expect(Object.keys(result)).toEqual([HEATING_PSEUDO_ID]);
    expect(result[HEATING_PSEUDO_ID]).toBe(1000); // +10 %
  });

  it("verändert Nicht-Heizkosten-Buckets nicht (pro costTypeId)", () => {
    const items: TariffInferenceItem[] = [
      {
        costTypeId: "wasser",
        allocationKey: "per_consumption_m3",
        amountCents: 50_000,
        unitPriceCents: 250,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
      {
        costTypeId: "wasser",
        allocationKey: "per_consumption_m3",
        amountCents: 55_000,
        unitPriceCents: 275,
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      },
    ];

    const result = inferTariffAdjustmentBpsFromInvoices({
      items,
      currentPeriod: period2025,
      followUpPeriod: period2026,
      heatingPseudoId: HEATING_PSEUDO_ID,
    });

    expect(result.wasser).toBe(1000); // +10 %
  });
});

describe("inferTariffAdjustmentBpsFromInvoices - Pauschal-Bucket", () => {
  it("zwei überlappungsfrei Halbjahres-Rechnungen werden korrekt zum Jahr addiert", () => {
    // Regressions-Schutz:
    // 2025: zwei Halbjahres-Pauschalen (je 50.000 ct) = 100.000 ct/Jahr
    // 2026: zwei Halbjahres-Pauschalen (je 55.000 ct) = 110.000 ct/Jahr
    // Erwartung: +10 %
    const items: TariffInferenceItem[] = [
      {
        costTypeId: "muell",
        allocationKey: "per_person",
        amountCents: 50_000,
        unitPriceCents: null,
        periodStart: "2025-01-01",
        periodEnd: "2025-06-30",
      },
      {
        costTypeId: "muell",
        allocationKey: "per_person",
        amountCents: 50_000,
        unitPriceCents: null,
        periodStart: "2025-07-01",
        periodEnd: "2025-12-31",
      },
      {
        costTypeId: "muell",
        allocationKey: "per_person",
        amountCents: 55_000,
        unitPriceCents: null,
        periodStart: "2026-01-01",
        periodEnd: "2026-06-30",
      },
      {
        costTypeId: "muell",
        allocationKey: "per_person",
        amountCents: 55_000,
        unitPriceCents: null,
        periodStart: "2026-07-01",
        periodEnd: "2026-12-31",
      },
    ];

    const result = inferTariffAdjustmentBpsFromInvoices({
      items,
      currentPeriod: period2025,
      followUpPeriod: period2026,
      heatingPseudoId: HEATING_PSEUDO_ID,
    });

    expect(result.muell).toBe(1000); // +10 %
  });

  it("kumulative Zusatzabgabe ab Jahresmitte addiert sich, statt zu verdünnen", () => {
    // Reales Szenario aus Abrechnung 0b4f... (Restmüll, Stadt Essen):
    // 2025: Jahres-Gebühr 396,00 €.
    // 2026: Jahres-Gebühr 409,20 € + zusätzliche Abgabe ab Mai 36,00 €.
    // Gesamt 2026 = 445,20 €. Erwartete Änderung: +12,42 %.
    //
    // Unter der alten Summe-Tage-Annualisierung kam -32,73 % heraus, weil
    // (40920 + 3600) x 365 / (365 + 245) ~= 26.644 ct als "Jahres"-Wert
    // verstanden wurde, obwohl beide Beträge im gleichen Kalenderjahr
    // anfallen.
    const items: TariffInferenceItem[] = [
      {
        costTypeId: "restmuell",
        allocationKey: "per_person",
        amountCents: 39_600,
        unitPriceCents: null,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
      {
        costTypeId: "restmuell",
        allocationKey: "per_person",
        amountCents: 40_920,
        unitPriceCents: null,
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      },
      {
        costTypeId: "restmuell",
        allocationKey: "per_person",
        amountCents: 3600,
        unitPriceCents: null,
        periodStart: "2026-05-01",
        periodEnd: "2026-12-31",
      },
    ];

    const result = inferTariffAdjustmentBpsFromInvoices({
      items,
      currentPeriod: period2025,
      followUpPeriod: period2026,
      heatingPseudoId: HEATING_PSEUDO_ID,
    });

    // (44520 / 39600 - 1) x 10000 = 1242,4... -> kaufmännisch gerundet 1242
    expect(result.restmuell).toBe(1242);
  });

  it("vollständige Überlappung zweier paralleler Pauschalen wird summiert", () => {
    // Zwei kumulative Gebühren mit exakt gleichem Zeitraum: ihre
    // Beträge addieren sich, Tage werden nur einmal gezählt.
    const items: TariffInferenceItem[] = [
      {
        costTypeId: "muell",
        allocationKey: "per_person",
        amountCents: 30_000,
        unitPriceCents: null,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
      {
        costTypeId: "muell",
        allocationKey: "per_person",
        amountCents: 40_000,
        unitPriceCents: null,
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      },
      {
        costTypeId: "muell",
        allocationKey: "per_person",
        amountCents: 5000,
        unitPriceCents: null,
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      },
    ];

    const result = inferTariffAdjustmentBpsFromInvoices({
      items,
      currentPeriod: period2025,
      followUpPeriod: period2026,
      heatingPseudoId: HEATING_PSEUDO_ID,
    });

    // (45000 / 30000 - 1) x 10000 = 5000 bps = +50 %
    expect(result.muell).toBe(5000);
  });

  it("ohne Follow-Item wird 0 % gemeldet (Vorjahres-Wert beibehalten)", () => {
    // Wenn für 2026 noch keine Pauschal-Position vorliegt, hat das
    // Ableitungs-Ergebnis für diese Kostenart keinen Mehrwert gegenüber
    // dem Vorjahres-Annahme-0 % - die Funktion gibt deshalb keinen
    // Eintrag aus (siehe `comparedAny` / Pauschal-/Tarif-Logik).
    const items: TariffInferenceItem[] = [
      {
        costTypeId: "muell",
        allocationKey: "per_person",
        amountCents: 39_600,
        unitPriceCents: null,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
    ];

    const result = inferTariffAdjustmentBpsFromInvoices({
      items,
      currentPeriod: period2025,
      followUpPeriod: period2026,
      heatingPseudoId: HEATING_PSEUDO_ID,
    });

    expect(result.muell).toBeUndefined();
  });
});
