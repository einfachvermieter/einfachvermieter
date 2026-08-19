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

const platformFromEnv = (): AppPlatform => {
  const value = process.env.APP_PLATFORM;
  return value === "macos" || value === "win" ? value : "server";
};

export const currentAppVersion = readCurrentVersion();
export const appPlatform = platformFromEnv();
