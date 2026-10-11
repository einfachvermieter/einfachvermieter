import { readFileSync } from "node:fs";
import {
  calculateStatement,
  type HeatingDetail,
  type StatementCalculationInput,
  statementResultSchema,
  type WaterMeterBundle,
} from "@einfachvermieter/shared";
import { type DocumentProps, Font, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  geistNormalPath,
  geistSemiboldPath,
  geistTnumNormalPath,
  geistTnumSemiboldPath,
} from "./fontPaths.js";
import { t } from "./i18n.js";
import {
  StatementDocument,
  type StatementDocumentProps,
} from "./StatementDocument.js";

// Gleiche Registrierung wie im API-Render-Pfad: react-pdf hält die
// Font-Registry global, ohne sie schlägt jeder Render fehl.
Font.register({
  family: "Geist",
  fonts: [
    { src: geistNormalPath, fontWeight: 400 },
    { src: geistSemiboldPath, fontWeight: 600 },
  ],
});
Font.register({
  family: "Geist Tnum",
  fonts: [
    { src: geistTnumNormalPath, fontWeight: 400 },
    { src: geistTnumSemiboldPath, fontWeight: 600 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const period = { start: "2025-01-01", end: "2025-12-31" };

const waterMeter = (
  id: string,
  role: "main" | "unit",
  unitId: string | null,
  startValue: number,
  endValue: number,
): WaterMeterBundle => ({
  meter: {
    id,
    type: "water_cold",
    role,
    unitId,
    label: id,
    measurementUnit: "m3",
    validFrom: period.start,
    validUntil: null,
  },
  readings: [
    {
      date: period.start,
      value: startValue,
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
});

const heatingDetail: HeatingDetail = {
  mode: "internal",
  billingInfoOmitted: false,
  totalHeatingCostsCents: 120_000,
  consumptionShareBps: 7000,
  consumptionPortionCents: 84_000,
  basicPortionCents: 36_000,
  // Fernwärme mit § 6a-Kennwerten, damit der Informations-Anhang alle
  // Energieträger-Zeilen rendert.
  fuelType: "district_heat",
  districtHeatInfo: { emissionsKgPerYear: 12_500, primaryEnergyFactor: 0.28 },
  perUnit: [
    {
      unitId: "u-eg",
      unitName: "EG",
      consumptionKwh: 5000,
      consumptionCostCents: 84_000,
      areaSqm: 80,
      basicCostCents: 36_000,
      totalCents: 120_000,
    },
  ],
  // Vorperiodenvergleich mit beiden Zeiträumen, damit die Balkengrafik
  // des § 6a-Anhangs durch den echten Renderer läuft.
  // HKV-Einheiten mit siebenstelligen Werten: der breiteste Anzeigefall
  // der Balkengrafik (Spaltenbreite `energyBarValue`).
  energyComparison: {
    consumptionUnit: "hkv_units",
    includesHotWater: false,
    current: {
      period,
      normalizedConsumption: 1_506_000,
      climateFactor: 1.28,
    },
    previous: {
      period: { start: "2024-01-01", end: "2024-12-31" },
      normalizedConsumption: 1_629_600,
      climateFactor: 1.35,
    },
  },
};

const grundsteuer: StatementCalculationInput["costTypes"][number] = {
  id: "ct-grundsteuer",
  name: "Grundsteuer",
  allocationKey: "per_living_area",
  costs: [
    {
      id: "c-1",
      costTypeId: "ct-grundsteuer",
      allocationKey: "per_living_area",
      name: "Grundsteuer",
      amountCents: 30_000,
      periodStart: period.start,
      periodEnd: period.end,
    },
  ],
};

/**
 * Über die echte Berechnungsschicht erzeugtes Ergebnis, damit die Fixture
 * bei Schema-Änderungen automatisch mitzieht.
 */
const result = calculateStatement({
  period,
  units: [
    {
      id: "u-eg",
      name: "EG",
      areaSqm: 80,
      occupantCount: 2,
      personDays: 730,
      occupiedDays: 365,
      periodDays: 365,
    },
  ],
  targetTenantId: "t-1",
  targetUnitId: "u-eg",
  costTypes: [grundsteuer],
  waterMeters: [
    waterMeter("HW", "main", null, 100, 180),
    waterMeter("WZ-EG", "unit", "u-eg", 10, 90),
  ],
  heatingDetail,
  totalAdvancesCents: 150_000,
  translate: t,
});

const meta: StatementDocumentProps["meta"] = {
  buildingName: "Beispielhaus",
  buildingAddress: "Musterstraße 1, 12345 Musterstadt",
  tenantName: "Erika Mustermann",
  tenantAddressStreet: "Musterstraße 1",
  tenantAddressCity: "12345 Musterstadt",
  unitName: "EG",
  unitNumber: null,
  unitAreaSqm: 80,
  buildingTotalAreaSqm: 200,
  statementReference: "NK-2025-0001-00",
  isDraft: false,
  senderName: "Max Vermieter",
  senderAddressStreet: "Vermieterweg 2",
  senderAddressPostalCode: "12345",
  senderAddressCity: "Musterstadt",
  documentDate: "2026-03-01",
  hasSepaMandate: false,
  hasBankAccount: false,
};

describe("StatementDocument", () => {
  it("rendert das Abrechnungs-PDF ohne Exception", async () => {
    const parsedResult = statementResultSchema.parse(result);

    const buffer = await renderToBuffer(
      (
        <StatementDocument result={parsedResult} meta={meta} />
      ) as unknown as ReactElement<DocumentProps>,
    );

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  describe("CO2-Einstufung bei Abrechnungszeitraum unter einem Jahr", () => {
    // Mit der Hochrechnung finalisiert: Jahreswert trotz kurzem Zeitraum
    const stored = statementResultSchema.parse(
      JSON.parse(
        readFileSync(
          new URL(
            "../../shared/src/schemas/fixtures/statement-result/v2-internal-co2-short-period.json",
            import.meta.url,
          ),
          "utf-8",
        ),
      ),
    );
    const { emissionsKgPerSqmYear: _yearValue, ...co2Fields } =
      stored.heatingDetail?.co2Detail ?? {};
    const shortened = statementResultSchema.parse({
      ...stored,
      heatingDetail: {
        ...stored.heatingDetail,
        co2Detail: {
          ...co2Fields,
          emissionsKgPerSqmPeriod: 13.3,
          periodShare: { numerator: 2, denominator: 3 },
        },
      },
    });

    const documentFor = (snapshot: typeof stored) => (
      <StatementDocument result={snapshot} meta={meta} />
    );
    /**
     * Texte des Dokuments ohne Layout. Die Fußzeile mit der Seitenzahl
     * entsteht erst beim Umbruch und fehlt hier.
     */
    const textOf = (snapshot: typeof stored): string =>
      renderToStaticMarkup(documentFor(snapshot))
        .replace(/<[^>]+>/gu, "")
        .replaceAll("&lt;", "<");
    const pageCount = async (snapshot: typeof stored): Promise<number> => {
      const buffer = await renderToBuffer(
        documentFor(snapshot) as unknown as ReactElement<DocumentProps>,
      );

      return (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/gu) ?? [])
        .length;
    };
    const co2 = (key: string, params?: Record<string, string>) =>
      t(`statements.pdf.heating.co2.${key}`, params);

    it("zeigt Ausstoß des Zeitraums, Stufe der Anlage und gekürzte Grenzwerte", () => {
      const text = textOf(shortened);

      expect(text).toContain(co2("emissionsPeriod"));
      // Hochgestellte 2 ist ein eigenes Element, im reinen Text steht "m2"
      expect(text).toContain("13,3\u00a0kg\u00a0CO₂/m2");
      expect(text).not.toContain("13,3\u00a0kg\u00a0CO₂/m2/a");
      expect(text).toContain("17 bis < 22\u00a0kg\u00a0CO₂/m2/a");
      expect(text).toContain(co2("tierShortened", { months: "8" }));
      expect(text).toContain("11,33 bis <\u00a014,67\u00a0kg\u00a0CO₂/m2");
      expect(text).not.toContain("14,67\u00a0kg\u00a0CO₂/m2/a");
      expect(text).toContain(co2("periodShareNote"));
      expect(text).not.toContain(co2("emissions"));
    });

    it("zeigt einen Snapshot mit Jahreswert wie vor der Umstellung", () => {
      const text = textOf(stored);

      expect(text).toContain(co2("emissions"));
      expect(text).toContain("20,0\u00a0kg\u00a0CO₂/m2/a");
      expect(text).toContain("17 bis < 22\u00a0kg\u00a0CO₂/m2/a");
      expect(text).not.toContain(co2("emissionsPeriod"));
      expect(text).not.toContain("von 12\u00a0Monaten");
      expect(text).not.toContain(co2("periodShareNote"));
    });

    it("erzeugt beide PDFs, die Zusatzzeilen verschieben keinen Seitenumbruch", async () => {
      const storedPages = await pageCount(stored);

      expect(storedPages).toBeGreaterThan(0);
      expect(await pageCount(shortened)).toBe(storedPages);
    }, 30_000);
  });

  it("rendert ohne Heizung, ohne Wasser und mit lückenhaftem Absender", async () => {
    const basicResult = statementResultSchema.parse(
      calculateStatement({
        period,
        units: [
          {
            id: "u-eg",
            name: "EG",
            areaSqm: 80,
            occupantCount: 2,
            personDays: 730,
            occupiedDays: 365,
            periodDays: 365,
          },
        ],
        targetTenantId: "t-1",
        targetUnitId: "u-eg",
        costTypes: [grundsteuer],
        waterMeters: [],
        totalAdvancesCents: 0,
        translate: t,
      }),
    );

    const buffer = await renderToBuffer(
      (
        <StatementDocument
          result={basicResult}
          meta={{ ...meta, senderAddressStreet: "", senderAddressCity: "" }}
        />
      ) as unknown as ReactElement<DocumentProps>,
    );

    expect(basicResult.heatingDetail).toBeUndefined();
    expect(basicResult.waterDetail).toBeUndefined();
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
