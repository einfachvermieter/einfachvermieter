import { APP_SETTINGS_ID, AppSettingsSchema } from "@einfachvermieter/db";
import { isNewerVersion } from "@einfachvermieter/shared";
import type { EntityManager } from "@mikro-orm/core";
import { getI18n } from "../i18n/i18n.registry.js";
import { currentAppVersion } from "./app-version.js";

/**
 * Versionen, wenn die Datenbank zuletzt von einer neueren App benutzt wurde
 */
export type DatabaseNewerThanApp = {
  lastVersion: string;
  currentVersion: string;
};

let lock: DatabaseNewerThanApp | null = null;

/**
 * Liefert den Versionskonflikt, solange die App deswegen gesperrt ist
 */
export const databaseNewerThanApp = (): DatabaseNewerThanApp | null => lock;

/**
 * Merkt in `app_settings.last_app_version`, welche App-Version die
 * Datenbank zuletzt benutzt hat. Ist dieser Stempel neuer als die laufende
 * Version, schreibt die App nichts mehr und sperrt sich (siehe AppLockGuard).
 */
export const checkDatabaseVersion = async (
  rootEm: EntityManager,
): Promise<void> => {
  const em = rootEm.fork();
  const settings = await em.findOne(AppSettingsSchema, { id: APP_SETTINGS_ID });
  const lastVersion = settings?.lastAppVersion ?? null;

  if (lastVersion && isNewerVersion(lastVersion, currentAppVersion)) {
    lock = { lastVersion, currentVersion: currentAppVersion };
    console.error(getI18n().t("errors.databaseNewerThanApp", lock));
    return;
  }

  // Keine Zeile anlegen: im local-Modus gilt eine vorhandene Zeile als
  // "eingerichtet". Wer die Zeile anlegt (Assistent, Einstellungen), setzt den
  // Stempel selbst.
  if (settings && lastVersion !== currentAppVersion) {
    settings.lastAppVersion = currentAppVersion;
    await em.flush();
  }
};
