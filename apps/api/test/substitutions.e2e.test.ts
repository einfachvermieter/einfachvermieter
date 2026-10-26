/**
 * Erfassungsausfall nach § 9a HeizkostenV über die echte HTTP-API gegen eine
 * Wegwerf-SQLite: offene Lücke blockiert das Finalisieren, Validierung und
 * Sperre der Erfassungsausfälle, Ausgleich im Folgejahr aus dem Snapshot.
 * Dazu der Grundkostenmaßstab der Heizung über einen Jahreswechsel.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HeatingSettingSchema } from "@einfachvermieter/db";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_EMAIL = "e2e.substitution@einfachvermieter.invalid";
const ADMIN_PASSWORD = "e2e-test-passwort-123";

let app: INestApplication;
let baseUrl: string;
let dataDir: string;
let authCookie = "";

const api = async (
  path: string,
  options: { method?: string; body?: unknown; expect: number },
  // biome-ignore lint/suspicious/noExplicitAny: E2E-Helper
): Promise<any> => {
  const method = options.method ?? "GET";
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authCookie ? { cookie: authCookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  if (response.status !== options.expect) {
    throw new Error(
      `${method} ${path} -> ${response.status} (erwartet ${options.expect}): ${text.slice(0, 500)}`,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "ev-e2e-substitution-"));
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_URL = "";
  process.env.DB_DRIVER = "";
  process.env.UPLOADS_DIR = join(dataDir, "uploads");
  process.env.MISTRAL_API_KEY = "";

  const { AppModule } = await import("../src/app.module.js");
  const { AuthService } = await import("../src/auth/auth.service.js");
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  await app.init();

  const orm = app.get(MikroORM);
  await orm.schema.create();
  const authService = app.get(AuthService);
  await RequestContext.create(orm.em, () =>
    authService.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: "admin",
    }),
  );

  await app.listen(0);
  baseUrl = (await app.getUrl()).replace("[::1]", "127.0.0.1");

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  authCookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

  await api("/settings/sender", {
    method: "PATCH",
    body: {
      senderName: "E2E Vermietung",
      senderAddressStreet: "Absenderweg 1",
      senderAddressPostalCode: "45127",
      senderAddressCity: "Essen",
      logoMode: "none",
      logoAlignment: "center",
      logoScalePercent: 100,
    },
    expect: 200,
  });
}, 60_000);

afterAll(async () => {
  await app?.close();
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

describe("Erfassungsausfall nach § 9a HeizkostenV", () => {
  it("blockiert Lücken, sperrt nach dem Finalisieren und gleicht im Folgejahr aus", async () => {
    const building = await api("/buildings", {
      method: "POST",
      body: {
        name: "Ausfall-Haus",
        addressStreet: "Zählerweg 9",
        addressPostalCode: "45128",
        addressCity: "Essen",
      },
      expect: 201,
    });
    const makeUnit = (name: string, areaSqm: number) =>
      api("/units", {
        method: "POST",
        body: { buildingId: building.id, name, areaSqm },
        expect: 201,
      });
    const unitA = await makeUnit("A", 20);
    const unitB = await makeUnit("B", 80);
    const unitC = await makeUnit("C", 100);

    const tenant = await api("/tenants", {
      method: "POST",
      body: {
        unitId: unitA.id,
        kind: "private",
        startDate: "2025-01-01",
        endDate: null,
        depositCents: 0,
        residents: [
          {
            resident: { firstName: "Anna", lastName: "Ausfall" },
            isContractParty: true,
          },
        ],
        rents: [
          {
            startDate: null,
            endDate: null,
            monthlyBaseRentCents: 50_000,
            monthlyAdvanceCents: 5000,
          },
        ],
      },
      expect: 201,
    });
    const tenantId: string = tenant.tenant.id;

    const makeMeter = (
      label: string,
      unitId: string | null,
      type: string,
      role: string,
    ) =>
      api("/meters", {
        method: "POST",
        body: {
          buildingId: building.id,
          unitId,
          type,
          role,
          label,
          measurementUnit: type === "water_cold" ? "m3" : "kwh",
          ...(type === "heat_meter"
            ? { costAllocationMode: "heating_cost_bill" }
            : {}),
          validFrom: "2025-01-01",
        },
        expect: 201,
      });
    const wmzA = await makeMeter("WMZ A", unitA.id, "heat_meter", "unit");
    const wmzB = await makeMeter("WMZ B", unitB.id, "heat_meter", "unit");
    const wmzC = await makeMeter("WMZ C", unitC.id, "heat_meter", "unit");
    const waterMain = await makeMeter(
      "Hauptwasserzähler",
      null,
      "water_cold",
      "main",
    );

    const addReading = (meterId: string, readingDate: string, value: number) =>
      api("/meters/readings", {
        method: "POST",
        body: { meterId, readingDate, value },
        expect: 201,
      });
    await addReading(wmzA.id, "2025-01-01", 10_000);
    await addReading(wmzA.id, "2025-12-31", 16_000);
    for (const [meterId, base] of [
      [wmzB.id, 0],
      [wmzC.id, 0],
      [waterMain.id, 0],
    ] as const) {
      await addReading(meterId, "2025-01-01", base);
      await addReading(meterId, "2025-12-31", base + 5000);
      await addReading(meterId, "2026-01-01", base + 5000);
      await addReading(meterId, "2026-12-31", base + 10_000);
    }

    const heatingCostType = await api("/costs/types", {
      method: "POST",
      body: {
        buildingId: building.id,
        name: "Heizung",
        category: "heating",
        defaultAllocationKey: null,
        laborCostCategory: null,
      },
      expect: 201,
    });
    for (const year of ["2025", "2026", "2027"]) {
      await api("/costs", {
        method: "POST",
        body: {
          buildingId: building.id,
          invoiceDate: `${year}-03-01`,
          vendor: "Stadtwerke",
          items: [
            {
              costTypeId: heatingCostType.id,
              amountCents: 100_000,
              periodStart: `${year}-01-01`,
              periodEnd: `${year}-12-31`,
            },
          ],
        },
        expect: 201,
      });
    }
    await api(`/buildings/${building.id}/heating`, {
      method: "POST",
      body: {
        mode: "internal",
        validFrom: "2025-01-01",
        validTo: null,
        baseSharePercent: 30,
        consumptionSharePercent: 70,
        baseMethod: "heated_area",
        consumptionMethod: "heat_meter",
        prorationMethod: "linear",
        heatingType: "central_without_hot_water",
        fuelType: "gas",
        hotWaterMeterId: null,
        hotWaterSupplyTemperatureCelsius: 60,
        co2CostShareEnabled: false,
      },
      expect: 201,
    });

    // -- 2026: Endstand von WMZ A fehlt ----------------------------------
    const statement2026 = await api("/statements", {
      method: "POST",
      body: {
        buildingId: building.id,
        tenantId,
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
      },
      expect: 201,
    });
    const gapPreview = await api(
      `/statements/preview/calculate?buildingId=${building.id}&tenantId=${tenantId}&from=2026-01-01&to=2026-12-31`,
      { expect: 200 },
    );
    const gapCodes = gapPreview.heatingDetail.warnings.map(
      (warning: { code: string }) => warning.code,
    );
    expect(gapCodes).toContain("consumptionGap");
    await api(`/statements/${statement2026.id}/finalize`, {
      method: "POST",
      expect: 400,
    });

    const base = {
      unitId: unitA.id,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      scope: "heating",
      reason: "reading_not_possible",
      reasonNote: null,
      affectedMeterIds: [wmzA.id],
      meterKeptCounting: true,
      affectedAreaSqm: null,
      method: "same_rooms_comparable_period",
      basisSource: "meter_readings",
      referencePeriodStart: "2025-01-01",
      referencePeriodEnd: "2025-12-31",
      referenceMeterIds: null,
      comparisonUnitIds: null,
      manualAffectedConsumption: null,
      manualTotalConsumption: null,
      manualComparisonConsumption: null,
      manualComparisonAreaSqm: null,
      basisNote: null,
    };
    const path = `/buildings/${building.id}/consumption-substitutions`;

    // Validierung
    await api(path, {
      method: "POST",
      body: { ...base, affectedMeterIds: [wmzB.id] },
      expect: 400,
    });
    await api(path, {
      method: "POST",
      body: { ...base, meterKeptCounting: null },
      expect: 400,
    });
    await api(path, {
      method: "POST",
      body: { ...base, referencePeriodStart: "2025-02-01" },
      expect: 400,
    });

    const options = await api(
      `${path}/options?unitId=${unitA.id}&scope=heating&periodStart=2026-01-01&periodEnd=2026-12-31&meterIds=${wmzA.id}`,
      { expect: 200 },
    );
    expect(options.referenceYears[0]).toMatchObject({
      years: 1,
      isUsable: true,
    });
    expect(options.meters).toEqual([
      expect.objectContaining({
        id: wmzA.id,
        isContinuous: true,
        hasGap: true,
      }),
    ]);

    const preview = await api(`${path}/preview`, {
      method: "POST",
      body: { existingId: null, substitution: base },
      expect: 201,
    });
    expect(preview.resolved.substituteConsumption).toBe(6000);

    const created = await api(path, {
      method: "POST",
      body: base,
      expect: 201,
    });
    await api(path, { method: "POST", body: base, expect: 409 });

    const finalized = await api(`/statements/${statement2026.id}/finalize`, {
      method: "POST",
      expect: 201,
    });
    const [snapshotSubstitution] =
      finalized.snapshotData.heatingDetail.substitutions;
    expect(snapshotSubstitution.perMeter[0]).toMatchObject({
      periodStartValue: 16_000,
      substituteConsumption: 6000,
    });
    expect(snapshotSubstitution.appliedToDistribution).toBe(true);
    const tenantNotices = finalized.snapshotData.heatingDetail.warnings.map(
      (warning: { code: string }) => warning.code,
    );
    expect(tenantNotices).toContain("substitutionHeatingSameRooms");

    const pdf = await fetch(
      `${baseUrl}/api/statements/${statement2026.id}/pdf`,
      {
        headers: { cookie: authCookie },
      },
    );
    expect(pdf.status).toBe(200);
    expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(1000);

    // Gesperrt nach dem Finalisieren
    await api(`/consumption-substitutions/${created.id}`, {
      method: "PATCH",
      body: { ...base, reasonNote: "geändert" },
      expect: 400,
    });
    await api(`/consumption-substitutions/${created.id}`, {
      method: "DELETE",
      expect: 400,
    });

    // -- 2027: echter Stand, Ausgleich ab 22.000 -------------------------
    await addReading(wmzA.id, "2027-12-31", 27_000);
    for (const meterId of [wmzB.id, wmzC.id, waterMain.id]) {
      await addReading(meterId, "2027-01-01", 10_000);
      await addReading(meterId, "2027-12-31", 15_000);
    }
    const preview2027 = await api(
      `/statements/preview/calculate?buildingId=${building.id}&tenantId=${tenantId}&from=2027-01-01&to=2027-12-31`,
      { expect: 200 },
    );
    const detail2027 = preview2027.heatingDetail;
    expect(detail2027.compensations[0]).toMatchObject({
      compensationValue: 22_000,
      resultingConsumption: 5000,
      source: { fromSnapshotOfStatementId: statement2026.id },
    });
    expect(
      detail2027.perUnit.find(
        (row: { unitId: string }) => row.unitId === unitA.id,
      ).consumptionKwh,
    ).toBe(5000);
    expect(
      detail2027.warnings.map((warning: { code: string }) => warning.code),
    ).toContain("substitutionCompensationHeating");

    // -- Teilnahme an der zentralen Versorgung ---------------------------
    const supplyPath = `/units/${unitC.id}/supply-exclusions`;
    const later = await api(supplyPath, {
      method: "POST",
      body: {
        scope: "heating",
        validFrom: "2028-01-01",
        validUntil: null,
        notes: null,
      },
      expect: 201,
    });
    // Überschneidung im selben Bereich
    await api(supplyPath, {
      method: "POST",
      body: {
        scope: "heating",
        validFrom: "2028-06-01",
        validUntil: null,
        notes: null,
      },
      expect: 409,
    });
    // Sperre: Die finalisierte Periode 2026 darf sich nicht ändern, ...
    await api(`/unit-supply-exclusions/${later.id}`, {
      method: "PATCH",
      body: {
        scope: "heating",
        validFrom: "2026-07-01",
        validUntil: null,
        notes: null,
      },
      expect: 400,
    });
    // ... außerhalb davon bleibt der Eintrag änderbar.
    await api(`/unit-supply-exclusions/${later.id}`, {
      method: "PATCH",
      body: {
        scope: "heating",
        validFrom: "2027-07-01",
        validUntil: null,
        notes: "Etagenheizung",
      },
      expect: 200,
    });

    const supplyCodes = async () => {
      const result = await api(
        `/statements/preview/calculate?buildingId=${building.id}&tenantId=${tenantId}&from=2027-01-01&to=2027-12-31`,
        { expect: 200 },
      );

      return result.heatingDetail;
    };
    const withoutBoundary = await supplyCodes();
    expect(
      withoutBoundary.warnings.find(
        (warning: { code: string }) =>
          warning.code === "supplyBoundaryReadingMissing",
      ).params,
    ).toMatchObject({ meterId: wmzC.id, date: "2027-06-30" });

    // Stand zur Umstellung; der Zähler läuft danach weiter bis 15.000
    await addReading(wmzC.id, "2027-06-30", 12_000);
    const withBoundary = await supplyCodes();
    expect(
      withBoundary.warnings.map((warning: { code: string }) => warning.code),
    ).not.toContain("supplyBoundaryReadingMissing");
    expect(
      withBoundary.perUnit.find(
        (row: { unitId: string }) => row.unitId === unitC.id,
      ).consumptionKwh,
    ).toBe(2000);
    expect(
      withBoundary.supply.heating.find(
        (row: { unitId: string }) => row.unitId === unitC.id,
      ),
    ).toMatchObject({ suppliedDays: 181, periodDays: 365 });

    await api(`/unit-supply-exclusions/${later.id}`, {
      method: "DELETE",
      expect: 200,
    });
    expect(await api(supplyPath, { expect: 200 })).toEqual([]);
  }, 120_000);
});

describe("Grundkostenmaßstab der Heizung über einen Jahreswechsel", () => {
  it("rechnet jedes Jahr mit dem Maßstab seiner Version, der Snapshot bleibt", async () => {
    const building = await api("/buildings", {
      method: "POST",
      body: {
        name: "Maßstab-Haus",
        addressStreet: "Flächenweg 2",
        addressPostalCode: "45128",
        addressCity: "Essen",
      },
      expect: 201,
    });
    // A: 80 qm Wohnfläche, 60 qm Heizfläche. B: 120 qm, keine Heizfläche.
    const unitA = await api("/units", {
      method: "POST",
      body: {
        buildingId: building.id,
        name: "A",
        areaSqm: 80,
        heatingAreaSqm: 60,
      },
      expect: 201,
    });
    const unitB = await api("/units", {
      method: "POST",
      body: { buildingId: building.id, name: "B", areaSqm: 120 },
      expect: 201,
    });
    const tenant = await api("/tenants", {
      method: "POST",
      body: {
        unitId: unitA.id,
        kind: "private",
        startDate: "2025-01-01",
        endDate: null,
        depositCents: 0,
        residents: [
          {
            resident: { firstName: "Mia", lastName: "Maßstab" },
            isContractParty: true,
          },
        ],
        rents: [
          {
            startDate: null,
            endDate: null,
            monthlyBaseRentCents: 50_000,
            monthlyAdvanceCents: 5000,
          },
        ],
      },
      expect: 201,
    });
    const tenantId: string = tenant.tenant.id;

    for (const unit of [unitA, unitB]) {
      const meter = await api("/meters", {
        method: "POST",
        body: {
          buildingId: building.id,
          unitId: unit.id,
          type: "heat_meter",
          role: "unit",
          label: `WMZ ${unit.name}`,
          measurementUnit: "kwh",
          costAllocationMode: "heating_cost_bill",
          validFrom: "2025-01-01",
        },
        expect: 201,
      });
      for (const [readingDate, value] of [
        ["2025-01-01", 0],
        ["2025-12-31", 5000],
        ["2026-01-01", 5000],
        ["2026-12-31", 10_000],
      ] as const) {
        await api("/meters/readings", {
          method: "POST",
          body: { meterId: meter.id, readingDate, value },
          expect: 201,
        });
      }
    }

    const heatingCostType = await api("/costs/types", {
      method: "POST",
      body: {
        buildingId: building.id,
        name: "Heizung",
        category: "heating",
        defaultAllocationKey: null,
        laborCostCategory: null,
      },
      expect: 201,
    });
    for (const year of ["2025", "2026"]) {
      await api("/costs", {
        method: "POST",
        body: {
          buildingId: building.id,
          invoiceDate: `${year}-03-01`,
          vendor: "Stadtwerke",
          items: [
            {
              costTypeId: heatingCostType.id,
              amountCents: 100_000,
              periodStart: `${year}-01-01`,
              periodEnd: `${year}-12-31`,
            },
          ],
        },
        expect: 201,
      });
    }

    const version = (
      baseMethod: string,
      validFrom: string,
      validTo: string | null,
    ) => ({
      mode: "internal",
      validFrom,
      validTo,
      baseSharePercent: 30,
      consumptionSharePercent: 70,
      baseMethod,
      consumptionMethod: "heat_meter",
      prorationMethod: "linear",
      heatingType: "central_without_hot_water",
      fuelType: "gas",
      hotWaterMeterId: null,
      hotWaterSupplyTemperatureCelsius: 60,
      co2CostShareEnabled: false,
    });
    const heatingPath = `/buildings/${building.id}/heating`;
    const version2025 = await api(heatingPath, {
      method: "POST",
      body: version("heated_area", "2025-01-01", "2025-12-31"),
      expect: 201,
    });
    await api(heatingPath, {
      method: "POST",
      body: version("living_area", "2026-01-01", null),
      expect: 201,
    });

    const preview = async (year: string) =>
      (
        await api(
          `/statements/preview/calculate?buildingId=${building.id}&tenantId=${tenantId}&from=${year}-01-01&to=${year}-12-31`,
          { expect: 200 },
        )
      ).heatingDetail;
    const rowA = (detail: {
      perUnit: Array<{
        unitId: string;
        areaSqm: number;
        basicCostCents: number;
      }>;
    }) => detail.perUnit.find((row) => row.unitId === unitA.id);

    // 30.000 Cent Grundkosten: 2025 nach Heizfläche 60 / 180, 2026 nach
    // Wohnfläche 80 / 200
    const detail2025 = await preview("2025");
    expect(detail2025.baseMethod).toBe("heated_area");
    expect(rowA(detail2025)).toMatchObject({
      areaSqm: 60,
      basicCostCents: 10_000,
    });
    const detail2026 = await preview("2026");
    expect(detail2026.baseMethod).toBe("living_area");
    expect(rowA(detail2026)).toMatchObject({
      areaSqm: 80,
      basicCostCents: 12_000,
    });

    // Erfassungsausfälle nehmen die Fläche aus derselben Version
    const wholeUnitArea = async (year: string) =>
      (
        await api(
          `/buildings/${building.id}/consumption-substitutions/options?unitId=${unitA.id}&scope=heating&periodStart=${year}-01-01&periodEnd=${year}-12-31&meterIds=`,
          { expect: 200 },
        )
      ).wholeUnitAreaSqm;
    expect(await wholeUnitArea("2025")).toBe(60);
    expect(await wholeUnitArea("2026")).toBe(80);

    // Finalisiert: Die API lehnt die Änderung des Maßstabs ab. Ändert er
    // sich trotzdem (direkt in der Datenbank), behält der Snapshot seinen
    // Maßstab und seine Flächen
    const statement2025 = await api("/statements", {
      method: "POST",
      body: {
        buildingId: building.id,
        tenantId,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
      expect: 201,
    });
    await api(`/statements/${statement2025.id}/finalize`, {
      method: "POST",
      expect: 201,
    });
    await api(`${heatingPath}/${version2025.id}`, {
      method: "PATCH",
      body: version("living_area", "2025-01-01", "2025-12-31"),
      expect: 400,
    });
    await app
      .get(MikroORM)
      .em.fork()
      .nativeUpdate(
        HeatingSettingSchema,
        { id: version2025.id },
        { baseMethod: "living_area" },
      );
    const stored = await api(`/statements/${statement2025.id}`, {
      expect: 200,
    });
    expect(stored.snapshotData.heatingDetail.baseMethod).toBe("heated_area");
    expect(rowA(stored.snapshotData.heatingDetail)?.areaSqm).toBe(60);
    expect((await preview("2025")).baseMethod).toBe("living_area");
  }, 120_000);
});
