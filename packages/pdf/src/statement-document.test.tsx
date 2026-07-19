import {
  calculateStatement,
  type HeatingDetail,
  statementResultSchema,
  type WaterMeterBundle,
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
  totalHeatingCostsCents: 120_000,
  consumptionShareBps: 7000,
  consumptionPortionCents: 84_000,
  basicPortionCents: 36_000,
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
  costTypes: [
    {
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
    },
  ],
  waterMeters: [
    waterMeter("HW", "main", null, 100, 180),
    waterMeter("WZ-EG", "unit", "u-eg", 10, 90),
  ],
  heatingDetail,
  totalAdvancesCents: 150_000,
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
});
