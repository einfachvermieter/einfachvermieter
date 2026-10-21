/**
 * Abweisungen über die echte HTTP-API gegen eine Wegwerf-SQLite:
 * Abrechnungszeitraum über 12 Monate, zweite finalisierte Abrechnung für
 * denselben Mieter und Zeitraum, Heizkosten bei einem Gebäude ohne
 * Heizkostenabrechnung, Anfrage-Limit für Login und Passwortwechsel.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_EMAIL = "e2e.rejects@einfachvermieter.invalid";
const ADMIN_PASSWORD = "e2e-test-passwort-123";

/**
 * Erlaubte Anfragen pro Minute auf Login und Passwortwechsel
 */
const PASSWORD_ATTEMPTS_PER_MINUTE = 10;

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

const login = (password: string) =>
  fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
  });

/**
 * Legt Gebäude, Wohnung, Mietvertrag und eine Rechnung für 2025 an und gibt
 * den Rumpf zum Anlegen einer Abrechnung zurück (Zeitraum fehlt noch).
 */
const createBillableTenant = async (suffix: string) => {
  const building = await api("/buildings", {
    method: "POST",
    body: {
      name: `Abweisungs-Haus ${suffix}`,
      addressStreet: "Prüfweg 1",
      addressPostalCode: "45130",
      addressCity: "Essen",
    },
    expect: 201,
  });
  const unit = await api("/units", {
    method: "POST",
    body: { buildingId: building.id, name: "EG", areaSqm: 60 },
    expect: 201,
  });
  const aggregate = await api("/tenants", {
    method: "POST",
    body: {
      unitId: unit.id,
      kind: "private",
      startDate: "2025-01-01",
      endDate: null,
      depositCents: 0,
      residents: [
        {
          resident: { firstName: "Paula", lastName: "Prüfer" },
          isContractParty: true,
        },
      ],
      rents: [
        {
          startDate: null,
          endDate: null,
          monthlyBaseRentCents: 50_000,
          monthlyAdvanceCents: 10_000,
        },
      ],
    },
    expect: 201,
  });
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
      buildingId: building.id,
      invoiceDate: "2025-02-15",
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

  return { buildingId: building.id, tenantId: aggregate.tenant.id };
};

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "ev-e2e-rejects-"));
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

  const session = await login(ADMIN_PASSWORD);
  authCookie = (session.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

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

describe("Abrechnungszeitraum über 12 Monate", () => {
  it("nimmt genau ein Jahr an und weist einen Tag mehr zurück", async () => {
    const tenant = await createBillableTenant("zeitraum");

    const rejected = await api("/statements", {
      method: "POST",
      body: { ...tenant, periodStart: "2025-01-01", periodEnd: "2026-01-01" },
      expect: 400,
    });
    expect(JSON.stringify(rejected)).toContain("periodEnd");

    await api("/statements", {
      method: "POST",
      body: { ...tenant, periodStart: "2025-01-01", periodEnd: "2025-12-31" },
      expect: 201,
    });
  });
});

describe("Zweite finalisierte Abrechnung für denselben Zeitraum", () => {
  it("weist Finalisieren und Anlegen ab, sobald eine Abrechnung finalisiert ist", async () => {
    const tenant = await createBillableTenant("doppelt");
    const body = {
      ...tenant,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    };

    // Zwei Entwürfe für denselben Zeitraum sind erlaubt.
    const first = await api("/statements", {
      method: "POST",
      body,
      expect: 201,
    });
    const second = await api("/statements", {
      method: "POST",
      body,
      expect: 201,
    });

    await api(`/statements/${first.id}/finalize`, {
      method: "POST",
      expect: 201,
    });

    const finalizedAgain = await api(`/statements/${first.id}/finalize`, {
      method: "POST",
      expect: 400,
    });
    expect(finalizedAgain.message).toContain("bereits finalisiert");

    const secondFinalize = await api(`/statements/${second.id}/finalize`, {
      method: "POST",
      expect: 400,
    });
    expect(secondFinalize.message).toContain("nur als Korrektur");

    // Auch ein nur teilweise überlappender Zeitraum zählt.
    const overlappingCreate = await api("/statements", {
      method: "POST",
      body: { ...tenant, periodStart: "2025-07-01", periodEnd: "2025-12-31" },
      expect: 400,
    });
    expect(overlappingCreate.message).toContain("nur als Korrektur");

    const stillDraft = await api(`/statements/${second.id}`, { expect: 200 });
    expect(stillDraft.status).toBe("draft");
  }, 60_000);
});

describe("Keine Heizkostenabrechnung", () => {
  /**
   * Vorschau der Abrechnung für ein Kalenderjahr
   */
  const previewOf = (
    tenant: { buildingId: string; tenantId: string },
    year: number,
    expectStatus: number,
  ) =>
    api(
      `/statements/preview/calculate?buildingId=${tenant.buildingId}&tenantId=${tenant.tenantId}&from=${year}-01-01&to=${year}-12-31`,
      { expect: expectStatus },
    );

  /**
   * Legt eine Heizkosten-Kostenart mit einer Jahresrechnung an
   */
  const addHeatingCosts = async (buildingId: string, year: number) => {
    const costType = await api("/costs/types", {
      method: "POST",
      body: {
        buildingId,
        name: `Heizung ${year}`,
        category: "heating",
        defaultAllocationKey: null,
        laborCostCategory: null,
      },
      expect: 201,
    });
    await api("/costs", {
      method: "POST",
      body: {
        buildingId,
        invoiceDate: `${year}-03-01`,
        items: [
          {
            costTypeId: costType.id,
            amountCents: 90_000,
            periodStart: `${year}-01-01`,
            periodEnd: `${year}-12-31`,
          },
        ],
      },
      expect: 201,
    });
  };

  it("rechnet ohne Heizkosten-Detail und lässt sich finalisieren", async () => {
    const tenant = await createBillableTenant("ohne-heizung");
    await api(`/buildings/${tenant.buildingId}/heating`, {
      method: "POST",
      body: { mode: "none", validFrom: "2025-01-01", validTo: null },
      expect: 201,
    });

    const preview = await previewOf(tenant, 2025, 200);
    expect(preview.heatingDetail).toBeUndefined();
    expect(preview.totalCostsCents).toBe(12_000);
    expect(preview.warnings).toEqual([]);

    const statement = await api("/statements", {
      method: "POST",
      body: { ...tenant, periodStart: "2025-01-01", periodEnd: "2025-12-31" },
      expect: 201,
    });
    await api(`/statements/${statement.id}/finalize`, {
      method: "POST",
      expect: 201,
    });
  }, 60_000);

  it("bricht mit erfassten Heizkosten ab", async () => {
    const tenant = await createBillableTenant("heizkosten-dezentral");
    await api(`/buildings/${tenant.buildingId}/heating`, {
      method: "POST",
      body: { mode: "none", validFrom: "2025-01-01", validTo: null },
      expect: 201,
    });
    await addHeatingCosts(tenant.buildingId, 2025);

    const rejected = await previewOf(tenant, 2025, 400);
    expect(rejected.message).toContain(
      "keine Heizkostenabrechnung eingerichtet, es sind aber Heizkosten erfasst",
    );
  }, 60_000);

  /**
   * Legt eine zentrale Heizkostenkonfiguration ab dem Stichtag an
   */
  const addCentralHeating = (buildingId: string, validFrom: string) =>
    api(`/buildings/${buildingId}/heating`, {
      method: "POST",
      body: {
        mode: "internal",
        validFrom,
        validTo: null,
        baseSharePercent: 30,
        consumptionSharePercent: 70,
        baseMethod: "living_area",
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

  it("rechnet nach der Umrüstung auf eine Zentralheizung wieder Heizkosten ab", async () => {
    const tenant = await createBillableTenant("umruestung");
    await api(`/buildings/${tenant.buildingId}/heating`, {
      method: "POST",
      body: { mode: "none", validFrom: "2025-01-01", validTo: "2025-12-31" },
      expect: 201,
    });
    await addCentralHeating(tenant.buildingId, "2026-01-01");
    await addHeatingCosts(tenant.buildingId, 2026);

    const before = await previewOf(tenant, 2025, 200);
    expect(before.heatingDetail).toBeUndefined();

    const after = await previewOf(tenant, 2026, 200);
    expect(after.heatingDetail.mode).toBe("internal");
    expect(after.heatingDetail.totalHeatingCostsCents).toBe(90_000);
  }, 60_000);

  it("warnt bei einer Umrüstung mitten im Zeitraum, auch ohne erfasste Heizkosten", async () => {
    const tenant = await createBillableTenant("umruestung-mitte");
    await api(`/buildings/${tenant.buildingId}/heating`, {
      method: "POST",
      body: { mode: "none", validFrom: "2025-01-01", validTo: "2025-06-30" },
      expect: 201,
    });
    await addCentralHeating(tenant.buildingId, "2025-07-01");

    const preview = await previewOf(tenant, 2025, 200);
    expect(preview.heatingDetail).toBeUndefined();
    expect(preview.warnings).toHaveLength(1);
    expect(preview.warnings[0]).toContain(
      "beginnt eine neue Heizkostenkonfiguration",
    );
  }, 60_000);
});

// Läuft als letztes: danach sind Login und Passwortwechsel für eine Minute
// gesperrt.
describe("Anfrage-Limit gegen Passwort-Raten", () => {
  it("sperrt den Login nach zehn Versuchen pro Minute", async () => {
    // Ein Login ist in beforeAll schon verbraucht.
    for (let attempt = 2; attempt <= PASSWORD_ATTEMPTS_PER_MINUTE; attempt++) {
      expect((await login("falsch")).status).toBe(401);
    }

    expect((await login("falsch")).status).toBe(429);
    // Auch das richtige Passwort kommt nicht mehr durch.
    expect((await login(ADMIN_PASSWORD)).status).toBe(429);
  }, 60_000);

  it("sperrt den Passwortwechsel nach zehn Versuchen pro Minute", async () => {
    const changePassword = () =>
      fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify({
          currentPassword: "falsch",
          newPassword: "e2e-neues-passwort-456",
        }),
      });

    for (let attempt = 1; attempt <= PASSWORD_ATTEMPTS_PER_MINUTE; attempt++) {
      expect((await changePassword()).status).not.toBe(429);
    }

    expect((await changePassword()).status).toBe(429);
  }, 60_000);
});
