import { describe, expect, it } from "vitest";
import { upstreamErrorDetail } from "./ai-client.js";
import {
  maskApiKey,
  providersWithEnvApiKey,
  resolveAiRuntimeConfig,
  type StoredAiSettings,
} from "./ai-config.js";
import { stripUnsupportedSchemaKeywords } from "./anthropic-client.js";

const NOTHING_STORED: StoredAiSettings = {
  aiProvider: null,
  aiApiKey: null,
  aiBaseUrl: null,
  aiModel: null,
};

const env = (values: Record<string, string>): NodeJS.ProcessEnv => values;

describe("resolveAiRuntimeConfig", () => {
  it("bleibt abgeschaltet, solange weder Einstellungen noch Umgebung einen Anbieter nennen", () => {
    expect(resolveAiRuntimeConfig(NOTHING_STORED, env({}))).toBeNull();
  });

  it("bleibt abgeschaltet, wenn dem Anbieter der nötige API-Key fehlt", () => {
    const config = resolveAiRuntimeConfig(
      { ...NOTHING_STORED, aiProvider: "openai" },
      env({}),
    );
    expect(config).toBeNull();
  });

  it("nutzt den Anbieter aus der Umgebung, wenn keiner eingestellt ist", () => {
    const config = resolveAiRuntimeConfig(
      NOTHING_STORED,
      env({ AI_PROVIDER: "mistral", AI_API_KEY_MISTRAL: "aus-der-umgebung" }),
    );

    expect(config?.provider).toBe("mistral");
    expect(config?.apiKey).toBe("aus-der-umgebung");
  });

  it("holt den API-Key anbieter-genau aus der Umgebung", () => {
    const config = resolveAiRuntimeConfig(
      { ...NOTHING_STORED, aiProvider: "gemini" },
      env({
        AI_API_KEY_MISTRAL: "falscher-anbieter",
        AI_API_KEY_GEMINI: "richtiger-anbieter",
      }),
    );

    expect(config?.apiKey).toBe("richtiger-anbieter");
  });

  it("lässt die Einstellungen die Umgebung überstimmen", () => {
    const config = resolveAiRuntimeConfig(
      {
        aiProvider: "anthropic",
        aiApiKey: "aus-den-einstellungen",
        aiBaseUrl: "https://proxy.example/v1",
        aiModel: "claude-sonnet-5",
      },
      env({
        AI_PROVIDER: "mistral",
        AI_API_KEY_ANTHROPIC: "aus-der-umgebung",
        AI_MODEL_ANTHROPIC: "claude-opus-5",
      }),
    );

    expect(config?.provider).toBe("anthropic");
    expect(config?.apiKey).toBe("aus-den-einstellungen");
    expect(config?.baseUrl).toBe("https://proxy.example/v1");
    expect(config?.model).toBe("claude-sonnet-5");
  });

  it("greift pro Feld einzeln auf Umgebung und Anbieter-Standard zurück", () => {
    const config = resolveAiRuntimeConfig(
      { ...NOTHING_STORED, aiProvider: "openai", aiApiKey: "gespeichert" },
      env({ AI_MODEL_OPENAI: "gpt-4o-mini" }),
    );

    // Modell aus der Umgebung, Adresse mangels Angabe vom Anbieter-Standard.
    expect(config?.model).toBe("gpt-4o-mini");
    expect(config?.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("kommt bei Ollama ohne API-Key aus und meldet die fehlende PDF-Fähigkeit", () => {
    const config = resolveAiRuntimeConfig(
      { ...NOTHING_STORED, aiProvider: "ollama" },
      env({}),
    );

    expect(config?.provider).toBe("ollama");
    expect(config?.apiKey).toBeNull();
    expect(config?.supportsPdf).toBe(false);
  });

  it("behandelt einen unbekannten Anbieter wie keinen", () => {
    const config = resolveAiRuntimeConfig(
      { ...NOTHING_STORED, aiProvider: "irgendwas" },
      env({}),
    );

    expect(config).toBeNull();
  });
});

describe("upstreamErrorDetail", () => {
  it("liest das OpenAI-Format", () => {
    expect(
      upstreamErrorDetail('{"error":{"message":"Guthaben aufgebraucht"}}'),
    ).toBe("Guthaben aufgebraucht");
  });

  it("liest Geminis in ein Array verpacktes Format", () => {
    expect(
      upstreamErrorDetail(
        '[{"error":{"message":"Invalid content part type"}}]',
      ),
    ).toBe("Invalid content part type");
  });

  it("liest Mistrals detail-Feld", () => {
    expect(upstreamErrorDetail('{"detail":"Invalid API Key"}')).toBe(
      "Invalid API Key",
    );
  });

  it("liest ein blankes message-Feld", () => {
    expect(upstreamErrorDetail('{"message":"Unauthorized"}')).toBe(
      "Unauthorized",
    );
  });

  it("liefert null bei unbrauchbaren Antworten", () => {
    expect(upstreamErrorDetail("<html>502 Bad Gateway</html>")).toBeNull();
    expect(upstreamErrorDetail('{"foo":"bar"}')).toBeNull();
    expect(upstreamErrorDetail('{"detail":"   "}')).toBeNull();
  });
});

describe("stripUnsupportedSchemaKeywords", () => {
  it("entfernt Wertebereiche auch aus verschachtelten Ebenen", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          maxItems: 50,
          items: {
            type: "object",
            properties: {
              amountNetCents: { type: ["integer", "null"], minimum: 0 },
              taxRateBps: {
                type: ["integer", "null"],
                minimum: 0,
                maximum: 10_000,
              },
            },
          },
        },
      },
    };

    expect(stripUnsupportedSchemaKeywords(schema)).toEqual({
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amountNetCents: { type: ["integer", "null"] },
              taxRateBps: { type: ["integer", "null"] },
            },
          },
        },
      },
    });
  });

  it("lässt tragende Angaben wie type, required und pattern unangetastet", () => {
    const schema = {
      type: "object",
      required: ["invoiceDate"],
      properties: {
        invoiceDate: {
          type: ["string", "null"],
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
      },
    };

    expect(stripUnsupportedSchemaKeywords(schema)).toEqual(schema);
  });
});

describe("maskApiKey", () => {
  it("zeigt Anfang und Ende, verdeckt den Rest", () => {
    expect(maskApiKey("sk-proj-ABCDEFGHIJKLMNOP-1234")).toBe(
      "sk-p••••••••1234",
    );
  });

  it("verdeckt kurze Keys vollständig", () => {
    expect(maskApiKey("kurz1234")).toBe("••••••••");
  });

  it("verrät die Länge des Keys nicht", () => {
    const kurz = maskApiKey("abcd".repeat(4));
    const lang = maskApiKey("abcd".repeat(40));

    expect(kurz).toHaveLength(16);
    expect(lang).toHaveLength(16);
  });

  it("liefert null ohne hinterlegten Key", () => {
    expect(maskApiKey(null)).toBeNull();
    expect(maskApiKey("   ")).toBeNull();
  });
});

describe("providersWithEnvApiKey", () => {
  it("meldet genau die Anbieter mit hinterlegtem API-Key", () => {
    const providers = providersWithEnvApiKey(
      env({ AI_API_KEY_OPENAI: "abc", AI_API_KEY_GEMINI: "   " }),
    );

    // Der reine Leerraum bei Gemini zählt nicht als API-Key.
    expect(providers).toEqual(["openai"]);
  });
});
