/**
 * Key des Builds: `<system>-<weg>`, z.B. `win-store` oder `macos-download`.
 * Wir beim Paket bauen gesetzt. Default `server`
 */
export type AppPlatform = string;

/**
 * Veröffentlichungsweg aus dem Plattform-Key. Ohne bekanntes Suffix
 * (z.B. `server`) bleibt es bei der Aktualisierungs-Anleitung.
 */
export const appDistribution = (
  platform: AppPlatform,
): "store" | "download" | "instructions" => {
  // biome-ignore lint/nursery/useDestructuring: lesbarer so
  const way = platform.split("-")[1];
  return way === "store" || way === "download" ? way : "instructions";
};

/**
 * Antwort von `GET /api/updates`. `latestVersion` und die Adressen sind nur
 * gesetzt, wenn die Prüfung erlaubt ist, geklappt hat und eine neuere
 * Version vorliegt. `downloadUrl` führt je Veröffentlichungsweg zum
 * Download, in den Store, Website oder zur Aktualisierungs-Anleitung (Server).
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
