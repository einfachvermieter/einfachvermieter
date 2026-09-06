import { readFileSync } from "node:fs";
import type { AppPlatform } from "@einfachvermieter/shared";

/**
 * Eigene Version aus der package.json der API. Alle Workspaces tragen
 * dieselbe Versionsnummer (Release-Bump im Root); die Desktop-App liest
 * dieselbe Nummer aus ihrer eigenen package.json.
 */
const readCurrentVersion = (): string => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version?: string };
  return packageJson.version ?? "0.0.0";
};

/**
 * Den Key des Builds setzt der Electron-Hauptprozess (bzw. das
 * Container-Image); ohne ist es eine Server-Installation.
 */
const platformFromEnv = (): AppPlatform =>
  process.env.APP_PLATFORM?.trim() || "server";

export const currentAppVersion = readCurrentVersion();
export const appPlatform = platformFromEnv();
