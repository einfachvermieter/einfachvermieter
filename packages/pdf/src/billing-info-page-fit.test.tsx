import {
  calculateStatement,
  type HeatingDetail,
  type Period,
  statementResultSchema,
} from "@einfachvermieter/shared";
import { type DocumentProps, Font, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
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

const period: Period = { start: "2025-01-01", end: "2025-12-31" };
const previousPeriod: Period = { start: "2024-01-01", end: "2024-12-31" };
const partialPeriod: Period = { start: "2025-03-01", end: "2025-12-31" };
const partialPrevious: Period = { start: "2024-02-01", end: "2024-12-31" };

/**
 * Heiz-Detail mit allen Blöcken, die den § 6a-Anhang füllen: Fernwärme
 * (vier Energieträger-Zeilen), erfasste Steuern und Entgelte sowie ein
 * vollständiger Vorperiodenvergleich.
 */
const fullBillingInfo = (
  comparison: HeatingDetail["energyComparison"],
): HeatingDetail => ({
  mode: "internal",
  billingInfoOmitted: false,
  totalHeatingCostsCents: 120_000,
  consumptionShareBps: 7000,
  consumptionPortionCents: 84_000,
  basicPortionCents: 36_000,
  fuelType: "district_heat",
  // Nicht erfasste Werte erzeugen die längsten Zellen ("Hierzu liegen
  // uns keine Angaben des Versorgers vor").
  districtHeatInfo: { emissionsKgPerYear: null, primaryEnergyFactor: null },
  containedTaxesCents: 74_434,
  // Alle Arten angehakt = längste Zelle des Steuern-Blocks
  containedTaxKinds: [
    "value_added_tax",
    "energy_tax",
    "co2_price",
    "concession_fee",
    "other",
  ],
  meteringServiceCostCents: 19_000,
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
    {
      unitId: "u-og",
      unitName: "OG",
      consumptionKwh: 4000,
      consumptionCostCents: 0,
      areaSqm: 80,
      basicCostCents: 0,
      totalCents: 0,
    },
  ],
  energyComparison: comparison,
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

const waterMeters = [
  {
    meter: {
      id: "HW",
      type: "water_cold" as const,
      role: "main" as const,
      unitId: null,
      label: "HW",
      measurementUnit: "m3" as const,
      validFrom: period.start,
      validUntil: null,
    },
    readings: [
      {
        date: period.start,
        value: 100,
        isCumulative: true,
        isEstimated: false,
      },
      { date: period.end, value: 180, isCumulative: true, isEstimated: false },
    ],
  },
];

/**
 * Rendert das Dokument und zählt die PDF-Seiten. Ohne Umbruch im
 * § 6a-Anhang sind es vier: Brief, Kostenaufstellung, Heizkosten-Anhang,
 * § 6a-Anhang.
 */
const renderPageCount = async (heatingDetail: HeatingDetail) => {
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
    costTypes: [],
    waterMeters,
    heatingDetail,
    totalAdvancesCents: 150_000,
    translate: t,
  });

  const buffer = await renderToBuffer(
    (
      <StatementDocument
        result={statementResultSchema.parse(result)}
        meta={meta}
      />
    ) as unknown as ReactElement<DocumentProps>,
  );

  return (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/gu) ?? [])
    .length;
};

/**
 * Der § 6a-Anhang soll auf eine Seite passen - er ist die Anlage, die der
 * Mieter am Stück lesen können muss. Die Fälle hier sind die dicksten
 * Ausbaustufen; kippt einer davon auf fünf Seiten, ist ein Block zu lang
 * geworden.
 */
describe("§ 6a-Anhang passt auf eine Seite", () => {
  it("volle Ausbaustufe mit Vorperiodenvergleich", async () => {
    expect(
      await renderPageCount(
        fullBillingInfo({
          consumptionUnit: "hkv_units",
          includesHotWater: false,
          current: {
            period,
            normalizedConsumption: 1_506_000,
            climateFactor: 1.28,
          },
          previous: {
            period: previousPeriod,
            normalizedConsumption: 1_629_600,
            climateFactor: 1.35,
          },
        }),
      ),
    ).toBe(4);
  }, 30_000);

  it("zusätzlich mit Warmwasser-Hinweis und hochgerechneten Zeiträumen", async () => {
    expect(
      await renderPageCount(
        fullBillingInfo({
          consumptionUnit: "kwh",
          includesHotWater: true,
          current: {
            period: partialPeriod,
            normalizedConsumption: 15_060,
            climateFactor: 1.28,
          },
          previous: {
            period: partialPrevious,
            normalizedConsumption: 16_296,
            climateFactor: 1.35,
          },
        }),
      ),
    ).toBe(4);
  }, 30_000);
});
