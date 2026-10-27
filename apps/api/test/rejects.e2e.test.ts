/**
 * Abweisungen über die echte HTTP-API gegen eine Wegwerf-SQLite:
 * Abrechnungszeitraum über 12 Monate, zweite finalisierte Abrechnung für
 * denselben Mieter und Zeitraum, Heizkosten bei einem Gebäude ohne
 * Heizkostenabrechnung, Betriebskosten ohne Verteilungsgrundlage,
 * Anfrage-Limit für Login und Passwortwechsel, Kostenarten aus Vorlagen.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HeatingSettingSchema } from "@einfachvermieter/db";
import { hasBlockingWarning } from "@einfachvermieter/shared";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getI18n } from "../src/i18n/i18n.registry.js";

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
const createBillableTenant = async (
  suffix: string,
  options: {
    heatingAreaSqm?: number;
    allocationKey?: "per_living_area" | "per_heating_area";
  } = {},
) => {
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
    body: {
      buildingId: building.id,
      name: "EG",
      areaSqm: 60,
      heatingAreaSqm: options.heatingAreaSqm ?? null,
    },
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
      defaultAllocationKey: options.allocationKey ?? "per_living_area",
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

describe("Betriebskosten ohne Verteilungsgrundlage", () => {
  it("lässt Kosten nach Heizfläche 0 nicht still verschwinden und sperrt das Finalisieren", async () => {
    const tenant = await createBillableTenant("ohne-flaeche", {
      heatingAreaSqm: 0,
      allocationKey: "per_heating_area",
    });
    await api(`/buildings/${tenant.buildingId}/heating`, {
      method: "POST",
      body: { mode: "none", validFrom: "2025-01-01", validTo: null },
      expect: 201,
    });

    const preview = await api(
      `/statements/preview/calculate?buildingId=${tenant.buildingId}&tenantId=${tenant.tenantId}&from=2025-01-01&to=2025-12-31`,
      { expect: 200 },
    );
    expect(preview.totalCostsCents).toBe(0);
    expect(preview.costWarnings).toEqual([
      { code: "costAllocationBaseZero", params: { label: "Grundsteuer" } },
    ]);
    expect(preview.warnings).toHaveLength(1);
    expect(preview.warnings[0]).toContain("Grundsteuer");

    const statement = await api("/statements", {
      method: "POST",
      body: { ...tenant, periodStart: "2025-01-01", periodEnd: "2025-12-31" },
      expect: 201,
    });
    const blocked = await api(`/statements/${statement.id}/finalize`, {
      method: "POST",
      expect: 400,
    });
    expect(blocked.message).toContain("noch nicht finalisieren");
  }, 60_000);
});

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

/**
 * Zentrale Heizkostenkonfiguration ab dem Stichtag, wie sie die API annimmt
 */
const centralHeating = (
  validFrom: string,
  fields: Record<string, unknown> = {},
) => ({
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
  ...fields,
});

/**
 * Legt eine zentrale Heizkostenkonfiguration ab dem Stichtag an
 */
const addCentralHeating = (
  buildingId: string,
  validFrom: string,
  fields: Record<string, unknown> = {},
) =>
  api(`/buildings/${buildingId}/heating`, {
    method: "POST",
    body: centralHeating(validFrom, fields),
    expect: 201,
  });

describe("Keine Heizkostenabrechnung", () => {
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

  it.each([
    ["ohne", false],
    ["mit", true],
  ])(
    "sperrt eine Umrüstung mitten im Zeitraum %s erfasste Heizkosten",
    async (label, withCosts) => {
      const tenant = await createBillableTenant(`umruestung-mitte-${label}`);
      await api(`/buildings/${tenant.buildingId}/heating`, {
        method: "POST",
        body: { mode: "none", validFrom: "2025-01-01", validTo: "2025-06-30" },
        expect: 201,
      });
      await addCentralHeating(tenant.buildingId, "2025-07-01");
      if (withCosts) {
        await addHeatingCosts(tenant.buildingId, 2025);
      }

      const preview = await previewOf(tenant, 2025, 200);
      expect(preview.heatingDetail).toBeUndefined();
      expect(preview.heatingConfigWarnings).toEqual([
        {
          code: "heatingConfigPlantChangedInPeriod",
          params: { date: "2025-07-01" },
        },
      ]);
      expect(hasBlockingWarning(preview)).toBe(true);
      expect(preview.warnings).toHaveLength(1);
      expect(preview.warnings[0]).toContain(
        "Zum 01.07.2025 ändert sich die Anlage",
      );

      const statement = await api("/statements", {
        method: "POST",
        body: { ...tenant, periodStart: "2025-01-01", periodEnd: "2025-12-31" },
        expect: 201,
      });
      const blocked = await api(`/statements/${statement.id}/finalize`, {
        method: "POST",
        expect: 400,
      });
      expect(blocked.message).toContain("noch nicht finalisieren");
    },
    60_000,
  );
});

describe("Wechsel der Heizkostenkonfiguration im Abrechnungszeitraum", () => {
  /**
   * Wärmemengenzähler mit Ständen für 2025 an der einzigen Wohnung
   */
  const addUnitHeatMeter = async (buildingId: string) => {
    const orm = app.get(MikroORM);
    const [unit] = await orm.em
      .fork()
      .getConnection()
      .execute<{ id: string }[]>("SELECT id FROM units WHERE building_id = ?", [
        buildingId,
      ]);
    const meter = await api("/meters", {
      method: "POST",
      body: {
        buildingId,
        unitId: unit?.id,
        type: "heat_meter",
        role: "unit",
        label: "WMZ EG",
        measurementUnit: "kwh",
        costAllocationMode: "heating_cost_bill",
        validFrom: "2025-01-01",
      },
      expect: 201,
    });
    for (const [readingDate, value] of [
      ["2025-01-01", 0],
      ["2025-12-31", 5000],
    ]) {
      await api("/meters/readings", {
        method: "POST",
        body: { meterId: meter.id, readingDate, value },
        expect: 201,
      });
    }
  };

  it("rechnet bei geändertem Prozentsatz mit der ersten Version, weist darauf hin und lässt finalisieren", async () => {
    const tenant = await createBillableTenant("prozentsatz-mitte");
    const first = await addCentralHeating(tenant.buildingId, "2025-01-01", {
      validTo: "2025-06-30",
    });
    const second = await addCentralHeating(tenant.buildingId, "2025-07-01", {
      baseSharePercent: 50,
      consumptionSharePercent: 50,
    });
    await addHeatingCosts(tenant.buildingId, 2025);
    await addUnitHeatMeter(tenant.buildingId);

    const switched = await previewOf(tenant, 2025, 200);
    expect(switched.heatingConfigWarnings).toEqual([
      {
        code: "heatingConfigScalesNotApplied",
        params: { date: "2025-07-01" },
      },
    ]);
    expect(switched.warnings).toHaveLength(1);
    expect(hasBlockingWarning(switched)).toBe(false);

    const statement = await api("/statements", {
      method: "POST",
      body: { ...tenant, periodStart: "2025-01-01", periodEnd: "2025-12-31" },
      expect: 201,
    });
    await api(`/statements/${statement.id}/finalize`, {
      method: "POST",
      expect: 201,
    });

    // Nach dem Finalisieren ist die Konfiguration gesperrt. Ohne die
    // spätere Version (direkt in der Datenbank) ergibt sich dasselbe
    // Ergebnis.
    const heatingPath = `/buildings/${tenant.buildingId}/heating`;
    await api(`${heatingPath}/${second.id}`, {
      method: "DELETE",
      expect: 400,
    });
    const em = app.get(MikroORM).em.fork();
    await em.nativeDelete(HeatingSettingSchema, { id: second.id });
    await em.nativeUpdate(
      HeatingSettingSchema,
      { id: first.id },
      { validTo: null },
    );
    const single = await previewOf(tenant, 2025, 200);
    expect(single.heatingConfigWarnings).toBeUndefined();
    expect(single.heatingDetail).toEqual(switched.heatingDetail);
    expect(single.balanceCents).toBe(switched.balanceCents);
  }, 60_000);

  it("rechnet die Folgeperiode mit dem neuen Prozentsatz", async () => {
    const tenant = await createBillableTenant("prozentsatz-folgejahr");
    await addCentralHeating(tenant.buildingId, "2025-01-01", {
      validTo: "2025-12-31",
    });
    await addCentralHeating(tenant.buildingId, "2026-01-01", {
      baseSharePercent: 50,
      consumptionSharePercent: 50,
    });
    await addHeatingCosts(tenant.buildingId, 2026);

    const next = await previewOf(tenant, 2026, 200);
    expect(next.heatingConfigWarnings).toBeUndefined();
    expect(next.heatingDetail.consumptionShareBps).toBe(5000);
  }, 60_000);

  it("bricht bei überlappenden Versionen ohne Vorrangregel ab", async () => {
    const tenant = await createBillableTenant("ueberlappung");
    const orm = app.get(MikroORM);
    await addCentralHeating(tenant.buildingId, "2025-01-01");
    // Der Service lehnt Überlappungen ab; im Bestand entstehen sie nur
    // durch Fehler, etwa eine zurückgespielte Sicherung.
    await RequestContext.create(orm.em, async () => {
      await orm.em
        .getConnection()
        .execute(
          "UPDATE heating_settings SET valid_to = '2025-08-31' WHERE building_id = ?",
          [tenant.buildingId],
        );
    });
    await addCentralHeating(tenant.buildingId, "2025-09-01");
    await RequestContext.create(orm.em, async () => {
      await orm.em
        .getConnection()
        .execute(
          "UPDATE heating_settings SET valid_from = '2025-07-01' WHERE building_id = ? AND valid_from = '2025-09-01'",
          [tenant.buildingId],
        );
    });

    const rejected = await previewOf(tenant, 2025, 400);
    expect(rejected.message).toContain(
      getI18n().t("warnings.heatingConfigOverlapInPeriod", {
        date: "01.07.2025",
      }),
    );
  }, 60_000);
});

describe("Kostenarten aus Vorlagen anlegen", () => {
  const operatingItem = (name: string) => ({
    name,
    category: "operating",
    defaultAllocationKey: "per_living_area",
    laborCostCategory: null,
  });

  const createBuilding = (suffix: string) =>
    api("/buildings", {
      method: "POST",
      body: {
        name: `Vorlagen-Haus ${suffix}`,
        addressStreet: "Vorlagenweg 1",
        addressPostalCode: "45130",
        addressCity: "Essen",
      },
      expect: 201,
    });

  const namesOf = async (buildingId: string): Promise<string[]> => {
    const costTypes: { name: string }[] = await api(
      `/costs/types?buildingId=${buildingId}`,
      { expect: 200 },
    );
    return costTypes
      .map((costType) => costType.name)
      .sort((left, right) => left.localeCompare(right));
  };

  it("legt alle Einträge an, auch mit einem Namen, den es im Gebäude schon gibt", async () => {
    const building = await createBuilding("alle");
    await api("/costs/types/bulk", {
      method: "POST",
      body: { buildingId: building.id, items: [operatingItem("Grundsteuer")] },
      expect: 201,
    });

    const created = await api("/costs/types/bulk", {
      method: "POST",
      body: {
        buildingId: building.id,
        items: [
          operatingItem("Grundsteuer"),
          {
            name: "Heizenergie",
            category: "heating",
            defaultAllocationKey: null,
            laborCostCategory: null,
            co2Tracked: true,
          },
        ],
      },
      expect: 201,
    });

    expect(created).toHaveLength(2);
    expect(await namesOf(building.id)).toEqual([
      "Grundsteuer",
      "Grundsteuer",
      "Heizenergie",
    ]);
  }, 60_000);

  it("legt nichts an, wenn ein Eintrag ungültig ist", async () => {
    const building = await createBuilding("ungueltig");
    const rejected = await api("/costs/types/bulk", {
      method: "POST",
      body: {
        buildingId: building.id,
        items: [
          operatingItem("Grundsteuer"),
          { ...operatingItem("Heizenergie"), co2Tracked: true },
        ],
      },
      expect: 400,
    });

    expect(JSON.stringify(rejected)).toContain("co2Tracked");
    expect(await namesOf(building.id)).toEqual([]);
  }, 60_000);

  it("weist gleiche Namen im selben Aufruf zurück", async () => {
    const building = await createBuilding("doppelt");
    const rejected = await api("/costs/types/bulk", {
      method: "POST",
      body: {
        buildingId: building.id,
        items: [operatingItem("Grundsteuer"), operatingItem(" grundsteuer ")],
      },
      expect: 400,
    });

    expect(rejected.errors).toEqual([
      expect.objectContaining({ path: ["items", 1, "name"] }),
    ]);
    expect(await namesOf(building.id)).toEqual([]);
  }, 60_000);

  it("weist unbekanntes Gebäude, leere und zu lange Listen zurück", async () => {
    const unknownBuilding = await api("/costs/types/bulk", {
      method: "POST",
      body: {
        buildingId: "00000000-0000-4000-8000-000000000099",
        items: [operatingItem("Grundsteuer")],
      },
      expect: 404,
    });
    expect(unknownBuilding.statusCode).toBe(404);

    const building = await createBuilding("grenzen");
    for (const items of [
      [],
      Array.from({ length: 51 }, (_, index) =>
        operatingItem(`Kostenart ${index}`),
      ),
    ]) {
      const rejected = await api("/costs/types/bulk", {
        method: "POST",
        body: { buildingId: building.id, items },
        expect: 400,
      });
      expect(rejected.statusCode).toBe(400);
    }
    expect(await namesOf(building.id)).toEqual([]);
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
