/**
 * Sperre der Heizkostenkonfiguration nach finalisierten Abrechnungen.
 * Abrechnungen entstehen direkt in der Datenbank: Die Sperre liest nur
 * Gebäude, Zeitraum und Status.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  HeatingSettingSchema,
  OperatingCostStatementSchema,
  type StatementStatus,
} from "@einfachvermieter/db";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_EMAIL = "e2e.heating-lock@einfachvermieter.invalid";
const ADMIN_PASSWORD = "e2e-test-passwort-123";

let app: INestApplication;
let orm: MikroORM;
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
  dataDir = mkdtempSync(join(tmpdir(), "ev-e2e-heating-lock-"));
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

  orm = app.get(MikroORM);
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
}, 60_000);

afterAll(async () => {
  await app?.close();
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

const internal = (
  validFrom: string,
  validTo: string | null,
  fields: Record<string, unknown> = {},
) => ({
  mode: "internal",
  validFrom,
  validTo,
  baseSharePercent: 30,
  consumptionSharePercent: 70,
  baseMethod: "living_area",
  consumptionMethod: "heat_meter",
  prorationMethod: "linear",
  heatingType: "central_without_hot_water",
  fuelType: "gas",
  hotWaterMeterId: null,
  hotWaterSupplyTemperatureCelsius: 60,
  co2CostShareEnabled: true,
  ...fields,
});

const LOCKED_2025 =
  "Für den Zeitraum 01.01.2025 bis 31.12.2025 ist bereits eine Abrechnung des Gebäudes finalisiert.";

let buildingCounter = 0;

/**
 * Gebäude mit einer Wohnung und einem Mieter; `statements` legt
 * Abrechnungen mit dem gewünschten Status direkt an.
 */
const setupBuilding = async () => {
  buildingCounter += 1;
  const building = await api("/buildings", {
    method: "POST",
    body: {
      name: `Sperre-Haus ${buildingCounter}`,
      addressStreet: "Sperrweg 1",
      addressPostalCode: "45128",
      addressCity: "Essen",
    },
    expect: 201,
  });
  const unit = await api("/units", {
    method: "POST",
    body: { buildingId: building.id, name: "A", areaSqm: 80 },
    expect: 201,
  });
  const tenant = await api("/tenants", {
    method: "POST",
    body: {
      unitId: unit.id,
      kind: "private",
      startDate: "2024-01-01",
      endDate: null,
      depositCents: 0,
      residents: [
        {
          resident: { firstName: "Sina", lastName: "Sperre" },
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
  const path = `/buildings/${building.id}/heating`;

  const addStatement = async (
    status: StatementStatus,
    periodStart = "2025-01-01",
    periodEnd = "2025-12-31",
    supersedesStatementId: string | null = null,
  ): Promise<string> => {
    const em = orm.em.fork();
    const statement = em.create(OperatingCostStatementSchema, {
      buildingId: building.id,
      tenantId: tenant.tenant.id,
      periodStart,
      periodEnd,
      status,
      documentDate: null,
      snapshotData: null,
      totalCostsCents: null,
      totalAdvancesCents: null,
      balanceCents: null,
      adjustedMonthlyAdvanceCents: null,
      adjustedAdvanceValidFrom: null,
      tariffAdjustmentBps: null,
      finalizedAt: null,
      finalizedByUserId: null,
      pdfPath: null,
      sequenceYear: null,
      sequenceNumber: null,
      revisionNumber: null,
      sentAt: null,
      supersedesStatementId,
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReason: null,
      notes: null,
    });
    await em.persist(statement).flush();
    return statement.id;
  };

  const setStatus = async (id: string, status: StatementStatus) => {
    await orm.em
      .fork()
      .nativeUpdate(OperatingCostStatementSchema, { id }, { status });
  };

  const create = (body: unknown, status = 201) =>
    api(path, { method: "POST", body, expect: status });
  const update = (id: string, body: unknown, status = 200) =>
    api(`${path}/${id}`, { method: "PATCH", body, expect: status });
  const remove = (id: string, status = 204) =>
    api(`${path}/${id}`, { method: "DELETE", expect: status });
  /**
   * Gespeicherte Versionen, neueste zuerst
   */
  const versions = () => api(path, { expect: 200 });

  return {
    building,
    addStatement,
    setStatus,
    create,
    update,
    remove,
    versions,
  };
};

describe("Sperre der Heizkostenkonfiguration", () => {
  it("sperrt Felder, Löschen und Kürzen im finalisierten Zeitraum", async () => {
    const house = await setupBuilding();
    const current = await house.create(internal("2020-01-01", null));
    await house.addStatement("finalized");

    for (const change of [
      { baseSharePercent: 40, consumptionSharePercent: 60 },
      { consumptionMethod: "heat_cost_allocator" },
      { prorationMethod: "degree_days" },
      { baseMethod: "heated_area" },
      { co2CostShareEnabled: false },
    ]) {
      const error = await house.update(
        current.id,
        internal("2020-01-01", null, change),
        400,
      );
      expect(error.message).toContain(LOCKED_2025);
    }
    await house.remove(current.id, 400);
    await house.update(current.id, internal("2020-01-01", "2025-06-30"), 400);
    await house.update(current.id, internal("2020-01-01", null), 200);

    await house.update(current.id, internal("2019-01-01", null), 200);
    await house.update(current.id, internal("2025-01-01", null), 200);
    await house.update(current.id, internal("2025-01-02", null), 400);

    await house.update(current.id, internal("2025-01-01", "2025-12-31"), 200);
    const next = await house.create(
      internal("2026-01-01", null, { fuelType: "oil" }),
    );
    await house.update(
      next.id,
      internal("2026-01-01", null, { fuelType: "pellets" }),
    );
    await house.remove(next.id);
  });

  it("sperrt includeBillingInfo extern und den Wechsel der Abrechnungsart", async () => {
    const house = await setupBuilding();
    const current = await house.create({
      mode: "external",
      validFrom: "2020-01-01",
      validTo: null,
      includeBillingInfo: true,
    });
    await house.addStatement("finalized");

    await house.update(
      current.id,
      {
        mode: "external",
        validFrom: "2020-01-01",
        validTo: null,
        includeBillingInfo: false,
      },
      400,
    );
    await house.update(current.id, internal("2020-01-01", null), 400);
    await house.update(
      current.id,
      { mode: "none", validFrom: "2020-01-01", validTo: null },
      400,
    );
    expect(await house.versions()).toMatchObject([
      { mode: "external", includeBillingInfo: true },
    ]);
  });

  it("lässt Füllwerte aus älteren Ständen beim erneuten Speichern außer Acht", async () => {
    const house = await setupBuilding();
    const external = await house.create({
      mode: "external",
      validFrom: "2020-01-01",
      validTo: "2024-12-31",
      includeBillingInfo: true,
    });
    const none = await house.create({
      mode: "none",
      validFrom: "2025-01-01",
      validTo: null,
    });
    // Bestandszeilen tragen andere Füllwerte, als heute geschrieben würden
    const em = orm.em.fork();
    await em.nativeUpdate(
      HeatingSettingSchema,
      { id: external.id },
      { baseMethod: "heated_area" },
    );
    await em.nativeUpdate(
      HeatingSettingSchema,
      { id: none.id },
      { baseSharePercent: 50, consumptionSharePercent: 50, fuelType: "oil" },
    );
    await house.addStatement("finalized", "2024-01-01", "2024-12-31");
    await house.addStatement("finalized", "2025-01-01", "2025-12-31");

    await house.update(external.id, {
      mode: "external",
      validFrom: "2020-01-01",
      validTo: "2024-12-31",
      includeBillingInfo: true,
    });
    await house.update(none.id, {
      mode: "none",
      validFrom: "2025-01-01",
      validTo: null,
    });
    await house.update(none.id, {
      mode: "none",
      validFrom: "2025-01-01",
      validTo: "2026-03-31",
    });
    await house.update(
      none.id,
      internal("2025-01-01", "2026-03-31", {
        baseSharePercent: 50,
        consumptionSharePercent: 50,
        fuelType: "oil",
      }),
      400,
    );
    await house.update(
      external.id,
      internal("2020-01-01", "2024-12-31", { baseMethod: "heated_area" }),
      400,
    );
    expect(await house.versions()).toMatchObject([
      { mode: "none", validTo: "2026-03-31" },
      { mode: "external" },
    ]);
  });

  it("Gebäude ohne Version: erste Version nach dem Zeitraum, none für den Zeitraum", async () => {
    const house = await setupBuilding();
    await house.addStatement("finalized");

    await house.create(internal("2025-01-01", null), 400);
    await house.create(
      {
        mode: "none",
        validFrom: "2025-01-01",
        validTo: "2025-03-31",
      },
      400,
    );
    const none = await house.create({
      mode: "none",
      validFrom: "2025-01-01",
      validTo: "2025-12-31",
    });
    await house.remove(none.id);
    await house.create(internal("2026-01-01", null));
    await house.create({
      mode: "none",
      validFrom: "2025-01-01",
      validTo: "2025-12-31",
    });
    expect(await house.versions()).toMatchObject([
      { mode: "internal" },
      { mode: "none" },
    ]);
  });

  it("nennt den ersten betroffenen Zeitraum", async () => {
    const house = await setupBuilding();
    const current = await house.create(internal("2020-01-01", null));
    await house.addStatement("finalized", "2025-01-01", "2025-12-31");
    await house.addStatement("finalized", "2024-01-01", "2024-12-31");

    const error = await house.remove(current.id, 400);
    expect(error.message).toContain(
      "Für den Zeitraum 01.01.2024 bis 31.12.2024",
    );
  });

  it("sperrt nur finalisierte Abrechnungen des eigenen Gebäudes", async () => {
    const house = await setupBuilding();
    const other = await setupBuilding();
    const current = await house.create(internal("2020-01-01", null));
    await other.addStatement("finalized");
    for (const status of ["draft", "cancelled", "superseded"] as const) {
      await house.addStatement(status);
    }

    await house.update(
      current.id,
      internal("2020-01-01", null, { fuelType: "oil" }),
    );
    await house.remove(current.id);
    expect(await house.versions()).toEqual([]);
  });

  it("Korrektur und Stornierung", async () => {
    const house = await setupBuilding();
    const current = await house.create(internal("2020-01-01", null));
    const change = internal("2020-01-01", null, { fuelType: "oil" });

    const original = await house.addStatement("finalized");
    const correction = await house.addStatement(
      "draft",
      "2025-01-01",
      "2025-12-31",
      original,
    );
    await house.update(current.id, change, 400);
    await orm.em
      .fork()
      .nativeDelete(OperatingCostStatementSchema, { id: correction });
    await house.update(current.id, change, 400);

    const second = await house.addStatement("finalized");
    await house.setStatus(original, "cancelled");
    await house.update(current.id, change, 400);
    await house.setStatus(second, "cancelled");
    await house.update(current.id, change);

    // Ersetzte Abrechnung mit finalisierter Korrektur: sperrt wegen der Korrektur
    const replaced = await house.addStatement("superseded");
    await house.update(current.id, internal("2020-01-01", null), 200);
    await house.addStatement("finalized", "2025-01-01", "2025-12-31", replaced);
    await house.update(current.id, change, 400);
    expect(await house.versions()).toMatchObject([{ fuelType: "gas" }]);
  });

  it("meldet bei Überlappung und Sperre zugleich die Überlappung", async () => {
    const house = await setupBuilding();
    await house.create(internal("2020-01-01", null));
    await house.addStatement("finalized");

    const error = await house.create(internal("2025-06-01", null), 400);
    expect(error.message).toContain("überlappt");
  });

  it("Altbestand: blockierter Zeitraum lässt sich nur auf die Version vom ersten Tag zurückführen", async () => {
    const house = await setupBuilding();
    const first = await house.create(internal("2020-01-01", "2025-06-30"));
    const later = await house.create(
      internal("2025-07-01", null, {
        consumptionMethod: "heat_cost_allocator",
      }),
    );
    await house.addStatement("finalized");

    const error = await house.update(
      later.id,
      internal("2025-07-01", null, {
        consumptionMethod: "heat_cost_allocator",
        fuelType: "oil",
      }),
      400,
    );
    expect(error.message).toContain(
      "Sie wurde mit der Version gerechnet, die am 01.01.2025 galt.",
    );
    await house.update(first.id, internal("2020-01-01", "2025-03-31"), 400);

    await house.update(
      later.id,
      internal("2026-01-01", null, {
        consumptionMethod: "heat_cost_allocator",
      }),
    );
    await house.update(first.id, internal("2020-01-01", "2025-12-31"));
    await house.update(
      first.id,
      internal("2020-01-01", "2025-12-31", { fuelType: "oil" }),
      400,
    );
  });

  it("Altbestand: Lücke nur mit den Werten der ersten Version füllen, rechenbar nur ohne spätere Version", async () => {
    const gapHouse = await setupBuilding();
    await gapHouse.create(internal("2020-01-01", "2025-06-30"));
    await gapHouse.create(internal("2026-01-01", null));
    await gapHouse.addStatement("finalized");
    await gapHouse.create(
      { mode: "none", validFrom: "2025-07-01", validTo: "2025-12-31" },
      400,
    );
    await gapHouse.create(
      internal("2025-07-01", "2025-12-31", { fuelType: "oil" }),
      400,
    );
    await gapHouse.create(internal("2025-07-01", "2025-12-31"));

    const laterHouse = await setupBuilding();
    const first = await laterHouse.create(internal("2020-01-01", "2025-03-31"));
    const later = await laterHouse.create(
      internal("2025-05-01", null, {
        baseSharePercent: 40,
        consumptionSharePercent: 60,
      }),
    );
    await laterHouse.addStatement("finalized");
    // Würde rechenbar, solange die spätere Version noch im Zeitraum liegt
    const error = await laterHouse.update(
      first.id,
      internal("2020-01-01", "2025-04-30"),
      400,
    );
    expect(error.message).toContain("Sie wurde mit der Version gerechnet");
    await laterHouse.remove(later.id);
    await laterHouse.update(first.id, internal("2020-01-01", null));
    expect(await gapHouse.versions()).toHaveLength(3);
  });

  it("eine nachträglich erfasste CO2-Rechnung hebt die Sperre nicht auf", async () => {
    const house = await setupBuilding();
    const first = await house.create(internal("2020-01-01", "2025-06-30"));
    const later = await house.create(
      internal("2025-07-01", null, { co2CostShareEnabled: false }),
    );
    await house.addStatement("finalized");

    const heatingCostType = await api("/costs/types", {
      method: "POST",
      body: {
        buildingId: house.building.id,
        name: "Gas",
        category: "heating",
        defaultAllocationKey: null,
        laborCostCategory: null,
      },
      expect: 201,
    });
    for (const [periodStart, periodEnd] of [
      ["2025-01-01", "2025-06-30"],
      ["2025-07-01", "2025-12-31"],
    ] as const) {
      await api("/costs", {
        method: "POST",
        body: {
          buildingId: house.building.id,
          invoiceDate: periodEnd,
          vendor: "Stadtwerke",
          items: [
            {
              costTypeId: heatingCostType.id,
              amountCents: 50_000,
              co2CostCents: 5000,
              periodStart,
              periodEnd,
            },
          ],
        },
        expect: 201,
      });
    }

    // Die Abrechnung ist jetzt durch den CO2-Konflikt blockiert, die
    // Konfiguration bleibt trotzdem gesperrt
    const error = await house.remove(later.id, 400);
    expect(error.message).toContain(LOCKED_2025);
    expect(error.message).not.toContain("Sie wurde mit der Version gerechnet");
    await house.update(first.id, internal("2020-01-01", "2025-03-31"), 400);
  });
});
