import type { SetupStatus } from "@einfachvermieter/shared";
import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { setupStatusQueryOptions } from "./lib/setup";

// Die Seitenmodule lesen beim Laden `window`. Für die Weichen des Routers
// reicht ein leeres Objekt, gerendert wird hier nichts.
vi.stubGlobal("window", {});

type Guard = (args: { context: { queryClient: QueryClient } }) => unknown;

let routes: Record<
  string,
  { options: { beforeLoad?: unknown; component?: unknown } }
>;
let MigrationFailedPage: unknown;

beforeAll(async () => {
  const { router } = await import("./router");
  routes = router.routesById;
  ({ MigrationFailedPage } = await import("./pages/auth/MigrationFailedPage"));
});

const LOCK_PATH = "/aktualisierung-fehlgeschlagen";

const status = (overrides: Partial<SetupStatus>): SetupStatus => ({
  needsSetup: false,
  authMode: "session",
  privacyUrl: "",
  licenseUrl: "",
  recovery: false,
  recoveryEmails: [],
  recoveryUsed: false,
  databaseNewerThanApp: null,
  migrationFailed: null,
  ...overrides,
});

const failed = status({
  migrationFailed: {
    lastVersion: "2026.1.0",
    currentVersion: "2026.2.0",
    migration: "Migration20261006163955",
    database: "libsql",
    state: "rolledBack",
    backupFile: null,
  },
});

/**
 * Führt die Weiche einer Route mit vorgegebenem Einrichtungs-Status aus und
 * liefert das Ziel der Umleitung, `null` ohne Umleitung
 */
const redirectTarget = async (
  routeId: string,
  setupStatus: SetupStatus,
): Promise<string | null> => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(setupStatusQueryOptions.queryKey, setupStatus);

  try {
    await (routes[routeId]?.options.beforeLoad as Guard)({
      context: { queryClient },
    });
  } catch (error) {
    if (isRedirect(error)) {
      return String(error.options.to);
    }
    throw error;
  }

  return null;
};

describe("Sperrseite nach gescheiterter Aktualisierung", () => {
  it("ersetzt abgesicherte Seiten, Anmeldung und Einrichtung", async () => {
    for (const routeId of ["/", "/gebaeude", "/anmelden", "/einrichtung"]) {
      expect(await redirectTarget(routeId, failed)).toBe(LOCK_PATH);
    }
  });

  it("zeigt die MigrationFailedPage und bleibt gesperrt erreichbar", async () => {
    expect(routes[LOCK_PATH]?.options.component).toBe(MigrationFailedPage);
    expect(await redirectTarget(LOCK_PATH, failed)).toBeNull();
  });

  it("ist ohne Sperre nicht erreichbar", async () => {
    expect(await redirectTarget(LOCK_PATH, status({}))).toBe("/");
  });
});
