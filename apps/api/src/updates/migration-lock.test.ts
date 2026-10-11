import { createI18nSync } from "@einfachvermieter/i18n";
import type { MigrationFailure } from "@einfachvermieter/shared";
import type { EntityManager } from "@mikro-orm/core";
import {
  type ExecutionContext,
  ServiceUnavailableException,
} from "@nestjs/common";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppLockGuard } from "../auth/app-lock.guard.js";
import { recoveryMode } from "../auth/auth-mode.js";
import type { LocalAdminService } from "../auth/local-admin.service.js";
import { HealthController } from "../health/health.controller.js";
import { setI18n } from "../i18n/i18n.registry.js";
import { SetupService } from "../setup/setup.service.js";
import type { TelemetryService } from "../telemetry/telemetry.service.js";
import { databaseNewerThanApp } from "./database-version-guard.js";
import { migrationFailure } from "./migration-guard.js";

vi.mock("./migration-guard.js", () => ({ migrationFailure: vi.fn() }));
vi.mock("./database-version-guard.js", () => ({
  databaseNewerThanApp: vi.fn(),
}));
vi.mock("../auth/auth-mode.js", () => ({
  authMode: () => "session",
  recoveryMode: vi.fn(),
}));

const failure: MigrationFailure = {
  lastVersion: "2026.1.0",
  currentVersion: "2026.2.0",
  migration: "Migration20261006163955",
  database: "libsql",
  state: "rolledBack",
  backupFile: "2026.2.0-2026-10-11-143000.db",
};

const contextFor = (path: string): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ path }) }),
  }) as unknown as ExecutionContext;

/**
 * Jeder Zugriff auf die Datenbank lässt den Test scheitern
 */
const untouchableEm = new Proxy(
  {},
  {
    get: () => {
      throw new Error("Zugriff auf die Datenbank");
    },
  },
) as EntityManager;

beforeAll(() => {
  setI18n(createI18nSync());
});

beforeEach(() => {
  vi.mocked(migrationFailure).mockReturnValue(failure);
  vi.mocked(databaseNewerThanApp).mockReturnValue(null);
  vi.mocked(recoveryMode).mockReturnValue(false);
});

describe("Sperre nach gescheiterter Aktualisierung", () => {
  it("lässt nur Status und Health-Check durch", () => {
    const guard = new AppLockGuard();

    expect(guard.canActivate(contextFor("/api/setup/status"))).toBe(true);
    expect(guard.canActivate(contextFor("/api/health"))).toBe(true);
    expect(() => guard.canActivate(contextFor("/api/buildings"))).toThrow(
      ServiceUnavailableException,
    );
    expect(() => guard.canActivate(contextFor("/api/auth/login"))).toThrow(
      ServiceUnavailableException,
    );
  });

  it("meldet im Health-Check die Sperre", () => {
    expect(new HealthController().check()).toMatchObject({
      status: "locked",
      reason: "migrationFailed",
    });
  });

  it("liefert den Status ohne Zugriff auf die Datenbank", async () => {
    const service = new SetupService(
      untouchableEm,
      {} as LocalAdminService,
      {} as TelemetryService,
    );

    expect(await service.getStatus()).toMatchObject({
      needsSetup: false,
      migrationFailed: failure,
    });
  });
});

describe("Health-Check in den übrigen Sperren", () => {
  beforeEach(() => {
    vi.mocked(migrationFailure).mockReturnValue(null);
  });

  it("meldet den Versionskonflikt", () => {
    vi.mocked(databaseNewerThanApp).mockReturnValue({
      lastVersion: "9999.1.0",
      currentVersion: "2026.2.0",
    });

    expect(new HealthController().check()).toMatchObject({
      status: "locked",
      reason: "databaseNewerThanApp",
    });
  });

  it("meldet den Rücksetz-Modus", () => {
    vi.mocked(recoveryMode).mockReturnValue(true);

    expect(new HealthController().check()).toMatchObject({
      status: "locked",
      reason: "recovery",
    });
  });
});

describe("ohne Sperre", () => {
  it("meldet der Health-Check ok", () => {
    vi.mocked(migrationFailure).mockReturnValue(null);

    const health = new HealthController().check();
    expect(health.status).toBe("ok");
    expect(health).not.toHaveProperty("reason");
  });
});
