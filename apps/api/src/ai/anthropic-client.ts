// biome-ignore-all lint/style/useNamingConvention: Feldnamen der Anthropic-Messages-API
import Anthropic from "@anthropic-ai/sdk";
import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { getI18n } from "../i18n/i18n.registry.js";
import {
  AI_MAX_OUTPUT_TOKENS,
  AI_TIMEOUT_MS,
  type AiChatRequest,
  type AiClient,
  type AiDebugRecorder,
  type AiDocumentInput,
  requireContent,
  splitDataUrl,
} from "./ai-client.js";
import { TRANSCRIPTION_INSTRUCTION } from "./prompts.js";

const logger = new Logger("AnthropicClient");

/**
 * Schema-Angaben, die Anthropics Structured Outputs ablehnen ("For 'integer'
 * type, property 'minimum' is not supported"). Sie werden vor dem Senden
 * entfernt; die Grenzen prüft ohnehin das Zod-Schema der Antwort, das
 * Wertebereiche und Datumsformat erneut durchsetzt.
 */
const UNSUPPORTED_SCHEMA_KEYWORDS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
]);

/**
 * Entfernt die nicht unterstützten Angaben rekursiv aus einem JSON-Schema.
 */
export const stripUnsupportedSchemaKeywords = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripUnsupportedSchemaKeywords);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !UNSUPPORTED_SCHEMA_KEYWORDS.has(key))
        .map(([key, nested]) => [key, stripUnsupportedSchemaKeywords(nested)]),
    );
  }

  return value;
};

/**
 * Text aus den Antwort-Blöcken zusammensetzen.
 */
const textFromBlocks = (blocks: Anthropic.ContentBlock[]): string =>
  blocks
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

export type AnthropicClientConfig = {
  apiKey: string;
  baseUrl: string | null;
  model: string;
};

/**
 * Client für Claude-Modelle. Anthropic nutzt eine eigene Messages-API mit
 * `document`/`image`-Blöcken statt der OpenAI-kompatiblen Schnittstelle.
 */
export class AnthropicClient implements AiClient {
  readonly model: string;

  private readonly client: Anthropic;

  constructor(config: AnthropicClientConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? undefined,
      timeout: AI_TIMEOUT_MS,
    });
    this.model = config.model;
  }

  transcribe(input: AiDocumentInput, debug?: AiDebugRecorder): Promise<string> {
    const { mediaType, base64 } = splitDataUrl(input.documentDataUrl);

    const documentBlock: Anthropic.ContentBlockParam = input.isImage
      ? {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType as Anthropic.Base64ImageSource["media_type"],
            data: base64,
          },
        }
      : {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        };

    return this.send(
      "ocr",
      {
        model: this.model,
        max_tokens: AI_MAX_OUTPUT_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              documentBlock,
              { type: "text", text: TRANSCRIPTION_INSTRUCTION },
            ],
          },
        ],
      },
      { model: this.model, document: `[${mediaType}, gekürzt]` },
      debug,
    );
  }

  chatJson(request: AiChatRequest, debug?: AiDebugRecorder): Promise<string> {
    return this.send(
      "chat",
      {
        model: this.model,
        max_tokens: AI_MAX_OUTPUT_TOKENS,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
        output_config: {
          format: {
            type: "json_schema",
            schema: stripUnsupportedSchemaKeywords(
              request.jsonSchema.schema,
            ) as Record<string, unknown>,
          },
        },
      },
      { model: this.model, userPrompt: request.userPrompt },
      debug,
    );
  }

  /**
   * Anfrage absetzen, Abbruchgründe auswerten und den Text zurückgeben.
   *
   * @param requestForDebug gekürzte Fassung der Anfrage fürs Debug-Protokoll
   */
  private async send(
    step: "ocr" | "chat",
    params: Anthropic.MessageCreateParamsNonStreaming,
    requestForDebug: unknown,
    debug?: AiDebugRecorder,
  ): Promise<string> {
    let message: Anthropic.Message;

    try {
      message = await this.client.messages.create(params);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger.warn(`Claude meldete einen Fehler (${step}): ${detail}`);
      debug?.record({
        step,
        request: requestForDebug,
        response: null,
        error: detail,
      });

      if (err instanceof Anthropic.APIError) {
        throw new ServiceUnavailableException(
          getI18n().t("errors.ai.upstreamErrorDetail", {
            step,
            status: err.status ?? 0,
            detail,
          }),
          { cause: err },
        );
      }

      throw err;
    }

    debug?.record({ step, request: requestForDebug, response: message });

    // Sicherheitsfilter können eine Anfrage ablehnen; dann ist `content` leer
    // oder unvollständig und darf nicht als Ergebnis durchgereicht werden.
    if (message.stop_reason === "refusal") {
      throw new ServiceUnavailableException(getI18n().t("errors.ai.refused"));
    }

    if (message.stop_reason === "max_tokens") {
      throw new ServiceUnavailableException(getI18n().t("errors.ai.truncated"));
    }

    return requireContent(textFromBlocks(message.content));
  }
}
