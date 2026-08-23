import { createI18nSync } from "@einfachvermieter/i18n";
import type { EntityManager } from "@mikro-orm/core";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { setI18n } from "../i18n/i18n.registry.js";
import { currentAppVersion } from "./app-version.js";
import {
  checkDatabaseVersion,
  databaseNewerThanApp,
} from "./database-version-guard.js";

beforeAll(() => {
  setI18n(createI18nSync());
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const emWithLastVersion = (lastAppVersion: string | null) => {
  const settings = { lastAppVersion };
  const flush = vi.fn();
  const em = {
    fork: () => ({
      findOne: async () => settings,
      flush,
    }),
  } as unknown as EntityManager;
  return { em, settings, flush };
};

describe("checkDatabaseVersion", () => {
  it("stempelt die eigene Version, wenn die Datenbank älter oder ungestempelt ist", async () => {
    const { em, settings, flush } = emWithLastVersion(null);
    await checkDatabaseVersion(em);
    expect(databaseNewerThanApp()).toBeNull();
    expect(settings.lastAppVersion).toBe(currentAppVersion);
    expect(flush).toHaveBeenCalledOnce();
  });

  it("schreibt nichts, wenn die Version unverändert ist", async () => {
    const { em, flush } = emWithLastVersion(currentAppVersion);
    await checkDatabaseVersion(em);
    expect(flush).not.toHaveBeenCalled();
  });

  it("sperrt ohne zu schreiben, wenn die Datenbank von einer neueren Version stammt", async () => {
    const { em, settings, flush } = emWithLastVersion("9999.1.0");
    await checkDatabaseVersion(em);
    expect(flush).not.toHaveBeenCalled();
    expect(settings.lastAppVersion).toBe("9999.1.0");
    expect(databaseNewerThanApp()).toEqual({
      lastVersion: "9999.1.0",
      currentVersion: currentAppVersion,
    });
  });
});
