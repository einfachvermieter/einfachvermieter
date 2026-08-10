// biome-ignore-all lint/style/useNamingConvention: Feldnamen der OpenAI-REST-API
import type { AiProvider } from "@einfachvermieter/shared";
import { Logger } from "@nestjs/common";
import {
  AI_TIMEOUT_MS,
  type AiChatRequest,
  type AiClient,
  type AiDebugRecorder,
  type AiDocumentInput,
  aiUpstreamError,
  requireContent,
} from "./ai-client.js";
import { TRANSCRIPTION_INSTRUCTION } from "./prompts.js";

const MISTRAL_OCR_MODEL = "mistral-ocr-latest";

const logger = new Logger("OpenAiCompatibleClient");

/**
 * Data-URL fürs Debug-Protokoll kürzen, da der Base64-Rumpf dort nutzlos ist.
 */
const redactDataUrl = (url: string): string =>
  `${url.slice(0, 40)}…[gekürzt, ${url.length} Zeichen gesamt]`;

/**
 * Anbieter, deren OpenAI-kompatible Schicht auch PDFs über `image_url`
 * entgegennimmt. Geminis Kompatibilitäts-Endpoint kennt den Datei-Block
 * nicht und lehnt ihn mit "Invalid content part type: file" ab.
 */
const PDF_VIA_IMAGE_URL: ReadonlySet<AiProvider> = new Set<AiProvider>([
  "gemini",
]);

/**
 * Inhaltsblock, mit dem das Dokument an ein multimodales Chat-Modell geht.
 * Bilder laufen immer über `image_url`, PDFs je nach Anbieter über den
 * Datei-Block oder ebenfalls über `image_url`.
 */
const documentContentBlock = (
  provider: AiProvider,
  input: AiDocumentInput,
): Record<string, unknown> =>
  input.isImage || PDF_VIA_IMAGE_URL.has(provider)
    ? { type: "image_url", image_url: { url: input.documentDataUrl } }
    : {
        type: "file",
        file: { filename: "rechnung.pdf", file_data: input.documentDataUrl },
      };

export type OpenAiCompatibleConfig = {
  provider: AiProvider;
  apiKey: string | null;
  baseUrl: string;
  model: string;
};

/**
 * Client für alle Anbieter mit OpenAI-kompatibler Chat-Schnittstelle:
 * Mistral, OpenAI, Gemini (Kompatibilitäts-Endpoint) und Ollama.
 *
 * Mistral bringt zusätzlich einen eigenen OCR-Endpoint mit und nutzt ihn für
 * die Texterkennung; die übrigen Anbieter lesen das Dokument direkt im Chat.
 */
export class OpenAiCompatibleClient implements AiClient {
  readonly model: string;

  private readonly provider: AiProvider;
  private readonly apiKey: string | null;
  private readonly baseUrl: string;

  constructor(config: OpenAiCompatibleConfig) {
    this.provider = config.provider;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/u, "");
    this.model = config.model;
  }

  transcribe(input: AiDocumentInput, debug?: AiDebugRecorder): Promise<string> {
    return this.provider === "mistral"
      ? this.transcribeViaMistralOcr(input, debug)
      : this.transcribeViaChat(input, debug);
  }

  async chatJson(
    request: AiChatRequest,
    debug?: AiDebugRecorder,
  ): Promise<string> {
    const body = {
      model: this.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: request.jsonSchema,
      },
      temperature: 0,
    };

    const json = await this.post<{
      choices?: Array<{ message?: { content?: string } }>;
    }>("chat", "/chat/completions", body, body, debug);

    return requireContent(json.choices?.[0]?.message?.content);
  }

  /**
   * Mistrals dedizierter OCR-Endpoint: liefert das Dokument seitenweise als
   * Markdown zurück.
   */
  private async transcribeViaMistralOcr(
    input: AiDocumentInput,
    debug?: AiDebugRecorder,
  ): Promise<string> {
    const body = {
      model: MISTRAL_OCR_MODEL,
      document: input.isImage
        ? { type: "image_url", image_url: input.documentDataUrl }
        : { type: "document_url", document_url: input.documentDataUrl },
      include_image_base64: false,
    };

    const json = await this.post<{
      pages?: Array<{ markdown?: string; text?: string }>;
    }>(
      "ocr",
      "/ocr",
      body,
      { ...body, document: redactDataUrl(input.documentDataUrl) },
      debug,
    );

    return (json.pages ?? [])
      .map((page) => page.markdown ?? page.text ?? "")
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Texterkennung über das multimodale Chat-Modell, für Anbieter ohne
   * eigenen OCR-Endpoint.
   */
  private async transcribeViaChat(
    input: AiDocumentInput,
    debug?: AiDebugRecorder,
  ): Promise<string> {
    const body = {
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            documentContentBlock(this.provider, input),
            { type: "text", text: TRANSCRIPTION_INSTRUCTION },
          ],
        },
      ],
      temperature: 0,
    };

    const json = await this.post<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(
      "ocr",
      "/chat/completions",
      body,
      { ...body, messages: "[Dokument gekürzt]" },
      debug,
    );

    return requireContent(json.choices?.[0]?.message?.content);
  }

  /**
   * Gemeinsamer POST samt Fehler- und Debug-Behandlung.
   *
   * @param requestForDebug gekürzte Fassung des Bodys fürs Debug-Protokoll
   */
  private async post<T>(
    step: "ocr" | "chat",
    path: string,
    body: unknown,
    requestForDebug: unknown,
    debug?: AiDebugRecorder,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Ollama läuft ohne API-Key, verlangt aber einen Header-Wert.
          Authorization: `Bearer ${this.apiKey ?? "none"}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
    } catch (err) {
      debug?.record({
        step,
        request: requestForDebug,
        response: null,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const error = aiUpstreamError(
        step,
        response.status,
        (message) => logger.warn(message),
        text.slice(0, 500),
      );
      debug?.record({
        step,
        request: requestForDebug,
        response: null,
        error: error.message,
      });
      throw error;
    }

    const json = (await response.json()) as T;
    debug?.record({ step, request: requestForDebug, response: json });

    return json;
  }
}
