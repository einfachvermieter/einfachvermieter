import { randomUUID } from "node:crypto";
import {
  APP_SETTINGS_ID,
  AppSettingsSchema,
  BuildingSchema,
  detectDialect,
  HeatingSettingSchema,
  MeterSchema,
  OperatingCostStatementSchema,
  TenantSchema,
  UnitSchema,
  UserSchema,
} from "@einfachvermieter/db";
import {
  AI_PROVIDER_INFO,
  type AiProvider,
  type AppPlatform,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { appPlatform, currentAppVersion } from "../updates/app-version.js";

const DEFAULT_TELEMETRY_URL = "https://api.einfachvermieter.de/v1/telemetry";
const FETCH_TIMEOUT_MS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SERVER_CHECK_EVERY_MS = 60 * 60 * 1000;

/** Abfrage der Server-Version je Dialekt */
const DB_VERSION_QUERY: Record<string, string> = {
  postgresql: "show server_version",
  mariadb: "select version() as version",
  libsql: "select sqlite_version() as version",
};

type TelemetryPayload = {
  installationId: string;
  version: string;
  platform: AppPlatform;
  os: string;
  arch: string;
  dbDialect: string;
  dbVersion: string | null;
  installedDaysAgo: number;
  userAccounts: number;
  buildings: number;
  units: number;
  tenants: number;
  largestBuildingUnits: number;
  meters: number;
  heatMeters: number;
  heatCostAllocators: number;
  buildingsHeatingInternal: number;
  buildingsHeatingExternal: number;
  statementsCurrentYear: number;
  statementsPreviousYear: number;
  finalizedCurrentYear: number;
  finalizedPreviousYear: number;
  aiProvider: string;
  aiModel: string | null;
  climateFactorsAutoFetch: boolean;
  updateCheckEnabled: boolean;
};

/**
 * Version des Datenbankservers. Bleibt leer, wenn die Abfrage scheitert;
 * lieber leer als ein Abbruch.
 */
const readDbVersion = async (em: EntityManager): Promise<string | null> => {
  const query = DB_VERSION_QUERY[detectDialect()];
  if (!query) {
    return null;
  }

  try {
    const rows = await em
      .getConnection()
      .execute<Record<string, unknown>[]>(query);
    const value = rows[0] ? Object.values(rows[0])[0] : null;
    return typeof value === "string" ? value.slice(0, 32) : null;
  } catch {
    return null;
  }
};

/**
 * Anzahl ohnungen im größten Gebäude
 */
const findLargestBuildingUnits = async (em: EntityManager): Promise<number> => {
  const units = await em.find(UnitSchema, {}, { fields: ["buildingId"] });
  const perBuilding = new Map<string, number>();
  for (const unit of units) {
    perBuilding.set(
      unit.buildingId,
      (perBuilding.get(unit.buildingId) ?? 0) + 1,
    );
  }
  return Math.max(0, ...perBuilding.values());
};

/**
 * Heizkosten-Modus je Gebäude, jeweils tages-gültig
 */
const countHeatingModes = async (
  em: EntityManager,
): Promise<{ internal: number; external: number }> => {
  const today = new Date().toISOString().slice(0, 10);
  const settings = await em.find(
    HeatingSettingSchema,
    { validFrom: { $lte: today } },
    {
      fields: ["buildingId", "mode", "validFrom"],
      orderBy: { validFrom: "asc" },
    },
  );

  const currentMode = new Map<string, string>();
  for (const setting of settings) {
    currentMode.set(setting.buildingId, setting.mode);
  }

  const modes = [...currentMode.values()];
  return {
    internal: modes.filter((mode) => mode === "internal").length,
    external: modes.filter((mode) => mode === "external").length,
  };
};

/**
 * Abrechnungen eines Abrechnungsjahres
 */
const countStatements = async (
  em: EntityManager,
  year: number,
  onlyFinalized: boolean,
): Promise<number> =>
  em.count(OperatingCostStatementSchema, {
    periodEnd: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
    ...(onlyFinalized ? { status: "finalized" } : {}),
  });

/**
 * Ob das Standardmodell des KI-Anbieters läuft oder ein eigenes
 */
const describeAiModel = (
  provider: string | null,
  model: string | null,
): string | null => {
  if (provider === null || !(provider in AI_PROVIDER_INFO)) {
    return null;
  }

  const fallback = AI_PROVIDER_INFO[provider as AiProvider].defaultModel;
  return model === null || model.trim() === "" || model === fallback
    ? "default"
    : "custom";
};

/**
 * Tage seit der Einrichtung dieser Installation.
 */
const daysSince = (isoDate: string | undefined): number => {
  const start = isoDate ? Date.parse(isoDate) : Number.NaN;
  return Number.isNaN(start)
    ? 0
    : Math.max(0, Math.floor((Date.now() - start) / DAY_MS));
};

/**
 * Pseudonyme Nutzungsstatistik, nur nach Einwilligung
 * Server: beim Start und dann stündlich prüfen, gesendet wird höchstens
 * einmal am Tag (Zeitpunkt der letzten Meldung in der DB).
 * Desktop-App: bei jedem Programmstart und dann alle 24 Stunden.
 * Beide senden zusätzlich sofort, wenn die Einwilligung erteilt wird.
 */
@Injectable()
export class TelemetryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TelemetryService.name);
  private readonly url = process.env.TELEMETRY_URL || DEFAULT_TELEMETRY_URL;
  private readonly desktop = appPlatform !== "server";
  private timer: ReturnType<typeof setInterval> | null = null;
  /**
   * Läufe nacheinander abarbeiten, damit Start und Einwilligung nicht
   * gleichzeitig senden.
   */
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly em: EntityManager) {}


  onApplicationBootstrap(): void {
    this.trigger(this.desktop);

    this.timer = setInterval(
      () => this.trigger(this.desktop),
      this.desktop ? DAY_MS : SERVER_CHECK_EVERY_MS,
    );

    // Der Timer darf den Prozess nicht am Beenden hindern
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * Nach erteilter Einwilligung sofort senden
   */
  sendAfterConsent(): void {
    this.trigger(true);
  }

  /**
   * Stellt einen Lauf hinten an. Fehler werden nur protokolliert.
   */
  private trigger(force: boolean): void {
    this.queue = this.queue
      .then(() => this.sendIfDue(force))
      .catch((error: unknown) => {
        this.logger.warn(`Nutzungsstatistik fehlgeschlagen: ${String(error)}`);
      });
  }

  /**
   * Sendet, wenn erlaubt und die letzte Meldung älter
   * als einen Tag ist.
   */
  async sendIfDue(force = false): Promise<void> {
    // Läuft außerhalb eines Request-Kontexts -> eigener EntityManager
    const em = this.em.fork();
    const settings = await em.findOne(AppSettingsSchema, {
      id: APP_SETTINGS_ID,
    });
    if (settings?.telemetryEnabled !== true) {
      return;
    }

    const lastSent = settings.telemetryLastSentAt
      ? Date.parse(settings.telemetryLastSentAt)
      : 0;
    if (!force && Date.now() - lastSent < DAY_MS) {
      return;
    }

    if (!settings.installationId) {
      settings.installationId = randomUUID();
      await em.flush();
    }

    const currentYear = new Date().getFullYear();
    const heatingModes = await countHeatingModes(em);

    const payload: TelemetryPayload = {
      installationId: settings.installationId,
      version: currentAppVersion,
      platform: appPlatform,
      os: process.platform,
      arch: process.arch,
      dbDialect: detectDialect(),
      dbVersion: await readDbVersion(em),
      installedDaysAgo: daysSince(settings.createdAt),
      userAccounts: await em.count(UserSchema, {}),
      buildings: await em.count(BuildingSchema, {}),
      units: await em.count(UnitSchema, {}),
      tenants: await em.count(TenantSchema, {}),
      largestBuildingUnits: await findLargestBuildingUnits(em),
      meters: await em.count(MeterSchema, { isActive: true }),
      heatMeters: await em.count(MeterSchema, {
        isActive: true,
        type: "heat_meter",
      }),
      heatCostAllocators: await em.count(MeterSchema, {
        isActive: true,
        type: "heat_cost_allocator",
      }),
      buildingsHeatingInternal: heatingModes.internal,
      buildingsHeatingExternal: heatingModes.external,
      statementsCurrentYear: await countStatements(em, currentYear, false),
      statementsPreviousYear: await countStatements(em, currentYear - 1, false),
      finalizedCurrentYear: await countStatements(em, currentYear, true),
      finalizedPreviousYear: await countStatements(em, currentYear - 1, true),
      aiProvider: settings.aiProvider ?? "none",
      aiModel: describeAiModel(settings.aiProvider, settings.aiModel),
      climateFactorsAutoFetch: settings.climateFactorsAutoFetch === true,
      updateCheckEnabled: settings.updateCheckEnabled === true,
    };

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(
          `Nutzungsstatistik abgelehnt: HTTP ${response.status}`,
        );
        return;
      }
    } catch (error) {
      this.logger.warn(
        `Nutzungsstatistik nicht gesendet: ${error instanceof Error ? error.message : String(error)}`,
      );

      return;
    }

    settings.telemetryLastSentAt = new Date().toISOString();
    await em.flush();
  }
}
