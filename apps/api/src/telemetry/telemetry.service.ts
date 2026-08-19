import { randomUUID } from "node:crypto";
import {
  APP_SETTINGS_ID,
  AppSettingsSchema,
  BuildingSchema,
  detectDialect,
  TenantSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import type { AppPlatform } from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { appPlatform, currentAppVersion } from "../updates/app-version.js";

const DEFAULT_TELEMETRY_URL = "https://api.einfachvermieter.de/v1/telemetry";
const FETCH_TIMEOUT_MS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SERVER_FIRST_CHECK_MS = 60 * 1000;
const SERVER_CHECK_EVERY_MS = 60 * 60 * 1000;
const DESKTOP_FIRST_SEND_MS = 15 * 1000;

type TelemetryPayload = {
  installationId: string;
  version: string;
  platform: AppPlatform;
  dbDialect: string;
  buildings: number;
  units: number;
  tenants: number;
};

/**
 * Anonyme Nutzungsstatistik, nur nach Einwilligung
 * Server: einmal am Tag, Zeitpunkt der letzten Meldung in der DB.
 * Desktop-App: bei jedem Programmstart und dann alle 24 Stunden.
 */
@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly url = process.env.TELEMETRY_URL || DEFAULT_TELEMETRY_URL;
  private timer: ReturnType<typeof setInterval> | null = null;
  private firstRun: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly em: EntityManager) {}

  onModuleInit(): void {
    const desktop = appPlatform !== "server";
    const run = () => {
      this.sendIfDue(desktop).catch((error: unknown) => {
        this.logger.warn(`Nutzungsstatistik fehlgeschlagen: ${String(error)}`);
      });
    };

    this.firstRun = setTimeout(
      run,
      desktop ? DESKTOP_FIRST_SEND_MS : SERVER_FIRST_CHECK_MS,
    );

    this.timer = setInterval(run, desktop ? DAY_MS : SERVER_CHECK_EVERY_MS);

    // Timer dürfen den Prozess nicht am Beenden hindern
    this.firstRun.unref();
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.firstRun) {
      clearTimeout(this.firstRun);
    }
    if (this.timer) {
      clearInterval(this.timer);
    }
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

    const payload: TelemetryPayload = {
      installationId: settings.installationId,
      version: currentAppVersion,
      platform: appPlatform,
      dbDialect: detectDialect(),
      buildings: await em.count(BuildingSchema, {}),
      units: await em.count(UnitSchema, {}),
      tenants: await em.count(TenantSchema, {}),
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
