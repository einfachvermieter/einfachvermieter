import {
  AI_PROVIDER_INFO,
  AI_PROVIDERS,
  type AiProvider,
} from "@einfachvermieter/shared";

/**
 * Die in der Datenbank hinterlegten Anbieter-Daten, inklusive API-Key.
 * Verlässt den Server nicht.
 */
export type StoredAiSettings = {
  aiProvider: string | null;
  aiApiKey: string | null;
  aiBaseUrl: string | null;
  aiModel: string | null;
};

/**
 * Die tatsächlich genutzte Anbindung, nachdem Einstellungen, Umgebung und
 * Anbieter-Standards zusammengeführt wurden.
 */
export type AiRuntimeConfig = {
  provider: AiProvider;
  apiKey: string | null;
  baseUrl: string;
  model: string;
  supportsPdf: boolean;
};

const trimmed = (value: string | null | undefined): string | null => {
  const result = value?.trim();
  return result ? result : null;
};

const asProvider = (value: string | null): AiProvider | null =>
  AI_PROVIDERS.find((provider) => provider === value) ?? null;

/**
 * Anzahl der Zeichen, die am Anfang und am Ende eines API-Keys sichtbar
 * bleiben. Genug, um den hinterlegten Key wiederzuerkennen, zu wenig, um
 * ihn zu benutzen.
 */
const VISIBLE_KEY_CHARS = 4;

/**
 * Baut die Anzeigefassung eines gespeicherten API-Keys: Anfang und Ende im
 * Klartext, der Rest verdeckt. Die Zahl der Punkte ist fest, damit die
 * Länge des Keys nicht mit ausgeliefert wird. Zu kurze Keys werden
 * vollständig verdeckt.
 *
 * @returns `null`, wenn kein Key hinterlegt ist
 */
export const maskApiKey = (apiKey: string | null): string | null => {
  const key = trimmed(apiKey);
  if (!key) {
    return null;
  }

  const dots = "•".repeat(8);
  if (key.length < VISIBLE_KEY_CHARS * 3) {
    return dots;
  }

  return `${key.slice(0, VISIBLE_KEY_CHARS)}${dots}${key.slice(-VISIBLE_KEY_CHARS)}`;
};

/**
 * Anbieter-spezifische Umgebungsvariable lesen, etwa `AI_API_KEY_MISTRAL`.
 * Der Suffix erlaubt es, für alle Anbieter gleichzeitig Werte zu hinterlegen
 * und zwischen ihnen zu wechseln, ohne die Umgebung anzufassen.
 */
const envFor = (
  env: NodeJS.ProcessEnv,
  field: "API_KEY" | "BASE_URL" | "MODEL",
  provider: AiProvider,
): string | null => trimmed(env[`AI_${field}_${provider.toUpperCase()}`]);

/**
 * Anbieter, für die in der Umgebung ein API-Key bereitliegt. Die
 * Oberfläche zeigt damit an, dass ohne eigene Eingabe schon ein Zugang
 * besteht.
 */
export const providersWithEnvApiKey = (env: NodeJS.ProcessEnv): AiProvider[] =>
  AI_PROVIDERS.filter((provider) => envFor(env, "API_KEY", provider) !== null);

/**
 * Führt gespeicherte Einstellungen, Umgebung und Anbieter-Standards zur
 * tatsächlich genutzten Anbindung zusammen. Was in der Oberfläche gesetzt
 * ist, gewinnt; die Umgebung dient als Vorbelegung.
 *
 * @returns `null`, wenn kein gültiger Anbieter gewählt ist oder der nötige API-Key fehlt, bleibt die KI-Extraktion abgeschaltet.
 */
export const resolveAiRuntimeConfig = (
  stored: StoredAiSettings,
  env: NodeJS.ProcessEnv,
): AiRuntimeConfig | null => {
  const provider =
    asProvider(trimmed(stored.aiProvider)) ??
    asProvider(trimmed(env.AI_PROVIDER));
  if (!provider) {
    return null;
  }

  const info = AI_PROVIDER_INFO[provider];
  const apiKey = trimmed(stored.aiApiKey) ?? envFor(env, "API_KEY", provider);
  if (info.requiresApiKey && !apiKey) {
    return null;
  }

  return {
    provider,
    apiKey,
    baseUrl:
      trimmed(stored.aiBaseUrl) ??
      envFor(env, "BASE_URL", provider) ??
      info.defaultBaseUrl,
    model:
      trimmed(stored.aiModel) ??
      envFor(env, "MODEL", provider) ??
      info.defaultModel,
    supportsPdf: info.supportsPdf,
  };
};
