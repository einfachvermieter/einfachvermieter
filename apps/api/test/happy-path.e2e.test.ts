/**
 * Happy-Path-E2E über die echte HTTP-API gegen eine Wegwerf-SQLite:
 *
 *   Login -> Gebäude -> Wohnung -> Mietvertrag -> Zähler+Stände -> Kostenart ->
 *   Rechnung -> Zahlung -> Preview -> Abrechnung -> Finalize -> PDF ->
 *   Mieterkonto-Settlement -> Lock-Verhalten -> Storno -> Delete-Guards.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_EMAIL = "e2e-admin@einfachvermieter.local";
const ADMIN_PASSWORD = "e2e-test-passwort-123";

let app: INestApplication;
let baseUrl: string;
let dataDir: string;
let authCookie = "";

type ApiCallOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * Erwarteter HTTP-Status. Abweichung schlägt mit Response-Body fehl
   */
  expect: number;
};

// biome-ignore lint/suspicious/noExplicitAny: E2E-Helper
const api = async (path: string, options: ApiCallOptions): Promise<any> => {
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
  dataDir = mkdtempSync(join(tmpdir(), "ev-e2e-"));
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_URL = "";
  process.env.DB_DRIVER = "";
  process.env.UPLOADS_DIR = join(dataDir, "uploads");
  process.env.MISTRAL_API_KEY = "";

  // AppModule erst NACH dem Setzen der Env importieren. Die ORM-Optionen
  // werden zwar lazy in der forRootAsync-Factory erzeugt, aber so ist die
  // Reihenfolge auch gegen zukünftige Eager-Reads robust.
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

  // Außerhalb eines HTTP-Requests gibt es keinen EM-Fork. Explizit einen
  // RequestContext aufspannen (wie es die Nest-Middleware pro Request tut).
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
}, 60_000);

afterAll(async () => {
  await app?.close();
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

describe("Happy Path", () => {
  it("durchläuft den kompletten Abrechnungs-Workflow", async () => {
    // ── Auth ────────────────────────────────────────────────────────────
    const failedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: "falsch" }),
    });

    expect(failedLogin.status).toBe(401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    expect(login.status).toBe(200);
    const setCookie = login.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("EVAuth=");
    authCookie = setCookie.split(";")[0] ?? "";

    // ── Stammdaten ──────────────────────────────────────────────────────
    const building = await api("/buildings", {
      method: "POST",
      body: {
        name: "E2E-Haus",
        addressStreet: "Teststraße 1",
        addressPostalCode: "45127",
        addressCity: "Essen",
      },
      expect: 201,
    });

    const unit = await api("/units", {
      method: "POST",
      body: { buildingId: building.id, name: "EG links", areaSqm: 100 },
      expect: 201,
    });

    const tenantAggregate = await api("/tenants", {
      method: "POST",
      body: {
        unitId: unit.id,
        kind: "private",
        startDate: "2025-01-01",
        endDate: null,
        depositCents: 0,
        residents: [
          {
            resident: { firstName: "Erika", lastName: "Mustermann" },
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
    const tenantId: string = tenantAggregate.tenant.id;

    // ── Zähler + Stände (Endstand bewusst geschätzt) ────────────────────
    const meter = await api("/meters", {
      method: "POST",
      body: {
        buildingId: building.id,
        type: "water_cold",
        role: "main",
        label: "Hauptwasserzähler",
        measurementUnit: "m3",
        validFrom: "2025-01-01",
      },
      expect: 201,
    });

    await api("/meters/readings", {
      method: "POST",
      body: { meterId: meter.id, readingDate: "2025-01-01", value: 0 },
      expect: 201,
    });

    await api("/meters/readings", {
      method: "POST",
      body: {
        meterId: meter.id,
        readingDate: "2025-12-31",
        value: 100,
        isEstimated: true,
      },
      expect: 201,
    });

    // ── Kostenart + Rechnung ────────────────────────────────────────────
    const costType = await api("/costs/types", {
      method: "POST",
      body: {
        buildingId: building.id,
        name: "Grundsteuer",
        category: "operating",
        defaultAllocationKey: "per_living_area",
        laborCostCategory: null,
      },
      expect: 201,
    });

    await api("/costs", {
      method: "POST",
      body: {
        invoiceDate: "2025-02-15",
        vendor: "Stadt Essen",
        items: [
          {
            costTypeId: costType.id,
            amountCents: 12_000,
            periodStart: "2025-01-01",
            periodEnd: "2025-12-31",
          },
        ],
      },
      expect: 201,
    });

    // ── Zahlung (Zweck Monat Januar) ────────────────────────────────────
    const payment = await api("/payments", {
      method: "POST",
      body: {
        tenantId,
        paymentDate: "2025-01-05",
        purpose: {
          kind: "month",
          forMonth: "2025-01",
          baseRentCents: 50_000,
          advanceCents: 5000,
        },
      },
      expect: 201,
    });

    // ── Live-Preview ────────────────────────────────────────────────────
    const preview = await api(
      `/statements/preview/calculate?buildingId=${building.id}&tenantId=${tenantId}&from=2025-01-01&to=2025-12-31`,
      { expect: 200 },
    );

    expect(preview.totalCostsCents).toBe(12_000);
    // Geschätzter Endstand -> übersetzte readingEstimated-Warnung sichtbar.
    expect(JSON.stringify(preview.warnings)).toContain("geschätzt");

    // ── Abrechnung anlegen + finalisieren ───────────────────────────────
    const balancesBefore = await api("/accounts/balances?asOf=2025-12-31", {
      expect: 200,
    });
    const balanceBefore = balancesBefore.find(
      (row: { tenantId: string }) => row.tenantId === tenantId,
    );
    expect(balanceBefore).toBeDefined();

    const statement = await api("/statements", {
      method: "POST",
      body: {
        buildingId: building.id,
        tenantId,
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
      },
      expect: 201,
    });
    expect(statement.status).toBe("draft");

    // H2-Regression (integritaet.md): zwei parallele Finalize-Requests
    // (Doppelklick/Retry) dürfen nur einmal buchen: genau ein 201, und
    // weiter unten genau ein Settlement auf dem Mieterkonto.
    const finalizeResponses = await Promise.all(
      [0, 1].map(() =>
        fetch(`${baseUrl}/api/statements/${statement.id}/finalize`, {
          method: "POST",
          headers: { cookie: authCookie },
        }),
      ),
    );
    const finalizeWinners = finalizeResponses.filter(
      (response) => response.status === 201,
    );
    expect(finalizeWinners).toHaveLength(1);
    const finalized = await finalizeWinners[0].json();

    expect(finalized.status).toBe("finalized");
    expect(finalized.totalCostsCents).toBe(12_000);
    expect(finalized.sequenceNumber).toBe(1);
    expect(finalized.snapshotData).toBeTruthy();

    // Schätzungs-Kennzeichnung sprachneutral im Snapshot persistiert.
    const waterWarnings: { code: string }[] =
      finalized.snapshotData.waterDetail?.warnings ?? [];
    expect(
      waterWarnings.some((warning) => warning.code === "readingEstimated"),
    ).toBe(true);

    // Saldo-Konsistenz: Kosten − Vorauszahlungen = Saldo.
    expect(finalized.balanceCents).toBe(
      finalized.totalCostsCents - finalized.totalAdvancesCents,
    );

    // ── PDF ─────────────────────────────────────────────────────────────
    const pdfResponse = await fetch(
      `${baseUrl}/api/statements/${statement.id}/pdf`,
      { headers: { cookie: authCookie } },
    );

    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers.get("content-type")).toContain(
      "application/pdf",
    );

    const pdfBytes = await pdfResponse.arrayBuffer();
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);

    // ── Mieterkonto: Settlement-Soll gebucht ────────────────────────────
    const balancesAfter = await api("/accounts/balances?asOf=2025-12-31", {
      expect: 200,
    });

    const balanceAfter = balancesAfter.find(
      (row: { tenantId: string }) => row.tenantId === tenantId,
    );

    expect(balanceAfter.balanceCents).toBe(
      balanceBefore.balanceCents - finalized.balanceCents,
    );

    const settlements = await api(`/accounts/${tenantId}/settlements`, {
      expect: 200,
    });

    expect(settlements).toHaveLength(1);
    expect(settlements[0].statementId).toBe(statement.id);

    // ── Lock: Zahlung in finalisierter Periode unveränderlich ───────────
    const lockError = await api(`/payments/${payment.id}`, {
      method: "DELETE",
      expect: 400,
    });
    expect(JSON.stringify(lockError)).toContain("finalisiert");

    // ── Delete-Guard: Mietvertrag mit Zahlungen/Abrechnungen ────────────
    await api(`/tenants/${tenantId}`, { method: "DELETE", expect: 400 });

    // ── Storno: Soll wird zurückgenommen ────────────────────────────────
    const cancelled = await api(`/statements/${statement.id}/cancel`, {
      method: "POST",
      body: { reason: "E2E-Storno-Test" },
      expect: 201,
    });
    expect(cancelled.status).toBe("cancelled");

    const balancesCancelled = await api("/accounts/balances?asOf=2025-12-31", {
      expect: 200,
    });

    const balanceCancelled = balancesCancelled.find(
      (row: { tenantId: string }) => row.tenantId === tenantId,
    );

    expect(balanceCancelled.balanceCents).toBe(balanceBefore.balanceCents);

    const settlementsAfterCancel = await api(
      `/accounts/${tenantId}/settlements`,
      { expect: 200 },
    );
    expect(settlementsAfterCancel).toHaveLength(0);
  }, 120_000);

  it("rechnet zentrale Heizung mit Warmwasser-WMZ ohne Fehler ab", async () => {
    const building = await api("/buildings", {
      method: "POST",
      body: {
        name: "Heiz-Haus",
        addressStreet: "Wärmeweg 2",
        addressPostalCode: "45128",
        addressCity: "Essen",
      },
      expect: 201,
    });

    const unitA = await api("/units", {
      method: "POST",
      body: { buildingId: building.id, name: "EG", areaSqm: 80 },
      expect: 201,
    });

    const unitB = await api("/units", {
      method: "POST",
      body: { buildingId: building.id, name: "OG", areaSqm: 80 },
      expect: 201,
    });

    const tenantAggregate = await api("/tenants", {
      method: "POST",
      body: {
        unitId: unitA.id,
        kind: "private",
        startDate: "2025-01-01",
        endDate: null,
        depositCents: 0,
        residents: [
          {
            resident: { firstName: "Hans", lastName: "Wärmer" },
            isContractParty: true,
          },
        ],
        rents: [
          {
            startDate: null,
            endDate: null,
            monthlyBaseRentCents: 60_000,
            monthlyAdvanceCents: 8000,
          },
        ],
      },
      expect: 201,
    });
    const tenantId: string = tenantAggregate.tenant.id;

    // Zwei Unit-WMZ + ein gebäudeweiter Boiler-WMZ (role=common, keine Unit).
    const makeHeatMeter = async (
      label: string,
      role: "unit" | "common",
      unitId: string | null,
    ) =>
      api("/meters", {
        method: "POST",
        body: {
          buildingId: building.id,
          unitId,
          type: "heat_meter",
          role,
          label,
          measurementUnit: "kwh",
          costAllocationMode: "heating_cost_bill",
          validFrom: "2025-01-01",
        },
        expect: 201,
      });

    const wmzA = await makeHeatMeter("WMZ EG", "unit", unitA.id);
    const wmzB = await makeHeatMeter("WMZ OG", "unit", unitB.id);
    const wmzBoiler = await makeHeatMeter(
      "Wärmemengenzähler Warmwasser",
      "common",
      null,
    );

    const addReading = async (meterId: string, value: number) => {
      await api("/meters/readings", {
        method: "POST",
        body: { meterId, readingDate: "2025-01-01", value: 0 },
        expect: 201,
      });

      await api("/meters/readings", {
        method: "POST",
        body: { meterId, readingDate: "2025-12-31", value },
        expect: 201,
      });
    };

    await addReading(wmzA.id, 6000);
    await addReading(wmzB.id, 4000);
    await addReading(wmzBoiler.id, 3000);

    // Wasser-Hauptzähler: die Wasserabrechnung läuft immer mit und verlangt
    // mindestens einen Hauptzähler (unabhängig von Wasser-Kostenarten).
    const waterMain = await api("/meters", {
      method: "POST",
      body: {
        buildingId: building.id,
        type: "water_cold",
        role: "main",
        label: "Hauptwasserzähler",
        measurementUnit: "m3",
        validFrom: "2025-01-01",
      },
      expect: 201,
    });
    await addReading(waterMain.id, 200);

    // Heizkostenart + Rechnung (Heizungstopf).
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

    await api("/costs", {
      method: "POST",
      body: {
        invoiceDate: "2025-03-01",
        vendor: "Stadtwerke",
        items: [
          {
            costTypeId: heatingCostType.id,
            amountCents: 240_000,
            periodStart: "2025-01-01",
            periodEnd: "2025-12-31",
          },
        ],
      },
      expect: 201,
    });

    // Zentrale Heizung MIT Warmwasser; Boiler-WMZ als hotWaterMeterId.
    await api(`/buildings/${building.id}/heating`, {
      method: "POST",
      body: {
        mode: "internal",
        validFrom: "2025-01-01",
        validTo: null,
        baseSharePercent: 30,
        consumptionSharePercent: 70,
        baseMethod: "area",
        consumptionMethod: "heat_meter",
        prorationMethod: "linear",
        heatingType: "central_with_hot_water",
        fuelType: "gas",
        hotWaterMeterId: wmzBoiler.id,
        hotWaterSupplyTemperatureCelsius: 60,
        totalHeatEnergyKwh: 10_000,
        co2CostShareEnabled: false,
      },
      expect: 201,
    });

    // Vor dem Fix warf dieser Aufruf 400 "heatingMeterNoUnit".
    const preview = await api(
      `/statements/preview/calculate?buildingId=${building.id}&tenantId=${tenantId}&from=2025-01-01&to=2025-12-31`,
      { expect: 200 },
    );

    expect(preview.heatingDetail).toBeTruthy();
    // Warmwasser wurde abgespalten (eigener Topf existiert).
    expect(preview.heatingDetail.hotWaterDetail).toBeTruthy();
    expect(preview.totalCostsCents).toBeGreaterThan(0);
  }, 120_000);
});

// Läuft nach dem Happy Path (ändert das Admin-Passwort und verwirft dabei
// alle Sessions, deshalb als letztes).
describe("Passwortwechsel invalidiert bestehende Sessions", () => {
  const cookieOf = (response: globalThis.Response) =>
    (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

  const login = async (password: string) =>
    fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password }),
    });

  const NEW_PASSWORD = "e2e-neues-passwort-456";

  it("macht die alte Session ungültig und stellt eine neue aus", async () => {
    // Zwei separate Sessions öffnen: die eine ändert das Passwort, die
    // andere ist die "gestohlene" und muss danach tot sein.
    const changerLogin = await login(ADMIN_PASSWORD);
    const changerCookie = cookieOf(changerLogin);
    const stolenLogin = await login(ADMIN_PASSWORD);
    const stolenCookie = cookieOf(stolenLogin);

    const changeResponse = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: changerCookie },
      body: JSON.stringify({
        currentPassword: ADMIN_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    });
    expect(changeResponse.status).toBe(200);

    // Der ändernde Client bekommt ein frisches Cookie und bleibt eingeloggt.
    const refreshedCookie = cookieOf(changeResponse);
    expect(refreshedCookie).toContain("EVAuth=");
    const meRefreshed = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: refreshedCookie },
    });
    expect(meRefreshed.status).toBe(200);

    // Die parallele (gestohlene) Session ist verworfen.
    const meStolen = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: stolenCookie },
    });
    expect(meStolen.status).toBe(401);

    // Und das alte Passwort funktioniert nicht mehr.
    const oldPasswordLogin = await login(ADMIN_PASSWORD);
    expect(oldPasswordLogin.status).toBe(401);
    const newPasswordLogin = await login(NEW_PASSWORD);
    expect(newPasswordLogin.status).toBe(200);
  }, 60_000);
});
