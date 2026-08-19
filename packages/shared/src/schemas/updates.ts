/**
 * Plattform der Installation
 */
export type AppPlatform = "macos" | "win" | "server";

/**
 * Antwort von `GET /api/updates`. `latestVersion` und die Adressen sind nur
 * gesetzt, wenn die Prüfung erlaubt ist, geklappt hat und eine neuere
 * Version vorliegt. `downloadUrl` führt je Plattform zum Download, Store
 * oder zur Aktualisierungs-Anleitung (Server).
 */
export type UpdateStatus = {
  enabled: boolean | null;
  platform: AppPlatform;
  currentVersion: string;
  latestVersion: string | null;
  downloadUrl: string | null;
  releaseNotesUrl: string | null;
  availableFrom: string | null;
};
