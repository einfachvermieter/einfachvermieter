import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";

export const AI_PROVIDERS = [
  "mistral",
  "openai",
  "anthropic",
  "gemini",
  "ollama",
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export type AiProviderInfo = {
  /**
   * Ob der Anbieter einen API-Key braucht. Ollama läuft lokal ohne.
   */
  requiresApiKey: boolean;
  /**
   * Vorbelegung für die Endpoint-Adresse. Leer, wenn die Anbieter-Bibliothek
   * ihren eigenen Standard mitbringt.
   */
  defaultBaseUrl: string;
  defaultModel: string;
  /**
   * Ob der Anbieter PDF-Dateien direkt lesen kann. Ollama verarbeitet nur
   * Bilder, PDFs müssen dort vorher exportiert werden.
   */
  supportsPdf: boolean;
  /**
   * Seite, auf der Nutzer den API-Key erzeugen. Null bei Ollama.
   */
  apiKeyUrl: string | null;
};

/**
 * Eigenschaften der unterstützten KI-Anbieter. Mistral, OpenAI, Gemini und
 * Ollama sprechen dieselbe OpenAI-kompatible Chat-Schnittstelle, Anthropic
 * eine eigene.
 */
export const AI_PROVIDER_INFO: Record<AiProvider, AiProviderInfo> = {
  mistral: {
    requiresApiKey: true,
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-medium-latest",
    supportsPdf: true,
    apiKeyUrl: "https://console.mistral.ai/api-keys",
  },
  openai: {
    requiresApiKey: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    supportsPdf: true,
    apiKeyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    requiresApiKey: true,
    defaultBaseUrl: "",
    defaultModel: "claude-opus-5",
    supportsPdf: true,
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  gemini: {
    requiresApiKey: true,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    // Mitlaufender Alias: Google zieht ältere Modellnamen für neue Nutzer
    // zurück, eine feste Version veraltet also absehbar.
    defaultModel: "gemini-flash-latest",
    supportsPdf: true,
    apiKeyUrl: "https://aistudio.google.com/apikey",
  },
  ollama: {
    requiresApiKey: false,
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2-vision",
    supportsPdf: false,
    apiKeyUrl: null,
  },
};

const optionalText = (max: number) =>
  z
    .string()
    .max(max, messageKey("validation.tooLong", { max }))
    .nullable()
    .optional();

export const aiSettingsUpdateSchema = z
  .object({
    /**
     * Null schaltet die KI-Extraktion ab.
     */
    aiProvider: z.enum(AI_PROVIDERS).nullable(),
    /**
     * Fehlt das Feld, bleibt der gespeicherte API-Key unverändert; ein
     * leerer String löscht ihn.
     */
    aiApiKey: z
      .string()
      .max(500, messageKey("validation.tooLong", { max: 500 }))
      .optional(),
    aiBaseUrl: optionalText(500),
    aiModel: optionalText(200),
  })
  .strict();

export type AiSettingsUpdateDto = z.infer<typeof aiSettingsUpdateSchema>;

export type AiSettingsDto = {
  aiProvider: AiProvider | null;
  aiBaseUrl: string | null;
  aiModel: string | null;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  providersWithEnvApiKey: AiProvider[];
};
