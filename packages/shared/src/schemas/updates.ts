import { z } from "zod";

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
 * `messages` enthält nur, was für diese Installation gilt, und ist ohne
 * erlaubte Prüfung leer.
 */
export type UpdateStatus = {
  enabled: boolean | null;
  platform: AppPlatform;
  currentVersion: string;
  latestVersion: string | null;
  downloadUrl: string | null;
  releaseNotesUrl: string | null;
  availableFrom: string | null;
  messages: UpdateMessage[];
};

/**
 * Links aus einer Mitteilung führen nur auf die Projektseite. Geprüft wird
 * der geparste Hostname, nicht die Adresse als Zeichenkette.
 */
const isProjectUrl = (value: string): boolean => {
  const url = URL.parse(value);
  return (
    url?.protocol === "https:" &&
    (url.hostname === "einfachvermieter.de" ||
      url.hostname.endsWith(".einfachvermieter.de"))
  );
};

const versionSchema = z.string().regex(/^\d+(\.\d+)*(-[0-9A-Za-z.]+)?$/u);
const valueListSchema = z.array(z.string()).min(1);

/**
 * Für wen eine Mitteilung gilt. Streng: Kennt die App eine Bedingung nicht,
 * fällt die Mitteilung weg, statt bei allen zu erscheinen. Eine leere Liste
 * ist ungültig und heißt nicht "für alle".
 */
const updateMessageConditionsSchema = z.strictObject({
  minVersion: versionSchema.optional(),
  belowVersion: versionSchema.optional(),
  platforms: valueListSchema.optional(),
  os: valueListSchema.optional(),
  dbDialects: valueListSchema.optional(),
});

export type UpdateMessageConditions = z.infer<
  typeof updateMessageConditionsSchema
>;

/**
 * Eintrag unter `messages` in der Versionsdatei. Ein ungültiger Link fällt
 * allein weg, die Mitteilung bleibt.
 */
export const updateMessageFeedSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(2000),
  closeLabel: z.string().min(1).max(30).nullable().default(null),
  display: z.enum(["once", "session"]),
  link: z
    .object({
      label: z.string().min(1).max(40),
      url: z.string().refine(isProjectUrl),
    })
    .nullable()
    .default(null)
    .catch(null),
  conditions: updateMessageConditionsSchema.optional(),
});

/**
 * Mitteilung des Projektservers, wie die Oberfläche sie zeigt. `once`
 * erscheint einmal je Browser oder Desktop-Installation, `session` einmal
 * je Sitzung. Ohne `closeLabel` beschriftet die Oberfläche den Button.
 */
export type UpdateMessage = Omit<
  z.infer<typeof updateMessageFeedSchema>,
  "conditions"
>;
