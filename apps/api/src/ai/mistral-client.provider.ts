// biome-ignore-all lint/style/useNamingConvention: Mistral REST API
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getI18n } from "../i18n/i18n.registry.js";

/**
 * ENV `MISTRAL_API_BASE` überschreibt den Endpoint (z. B. Proxy/Azure-Mistral).
 */
const MISTRAL_API_BASE =
  process.env.MISTRAL_API_BASE?.trim() || "https://api.mistral.ai/v1";
const DEFAULT_MODEL = "mistral-medium-latest";
const DEFAULT_OCR_MODEL = "mistral-ocr-latest";

const MISTRAL_TIMEOUT_MS = 60_000;

export type MistralChatRequest = {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  jsonSchema?: { name: string; strict: boolean; schema: unknown };
  temperature?: number;
};

export type MistralOcrRequest = {
  documentDataUrl: string;
  isImage: boolean;
};

export type MistralDebugEntry = {
  step: "ocr" | "chat";
  request: unknown;
  response: unknown;
  error?: string;
};

export type MistralDebugRecorder = {
  record: (entry: MistralDebugEntry) => void;
};

const buildOcrDocument = (input: MistralOcrRequest): Record<string, string> =>
  input.isImage
    ? { type: "image_url", image_url: input.documentDataUrl }
    : { type: "document_url", document_url: input.documentDataUrl };

/**
 * HTTP-Header mit Bearer-Auth
 */
const authHeaders = (key: string): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${key}`,
});

const ocrBody = (model: string, input: MistralOcrRequest): string =>
  JSON.stringify({
    model,
    document: buildOcrDocument(input),
    include_image_base64: false,
  });

const chatBody = (req: MistralChatRequest): string =>
  JSON.stringify({
    model: req.model,
    messages: req.messages,
    response_format: req.jsonSchema
      ? { type: "json_schema", json_schema: req.jsonSchema }
      : undefined,
    temperature: req.temperature ?? 0,
  });

/**
 * Data-URL (base64-PDF/Bild) kürzen, da im Debug-Dump nutzlos.
 */
const redactDocumentDataUrl = (input: MistralOcrRequest): MistralOcrRequest => {
  const url = input.documentDataUrl;
  const head = url.slice(0, 40);
  return {
    ...input,
    documentDataUrl: `${head}…[truncated, ${url.length} chars total]`,
  };
};

@Injectable()
export class MistralClient {
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly ocrModel: string;
  private readonly debugEnabled: boolean;

  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY?.trim() || null;
    this.model = process.env.MISTRAL_MODEL?.trim() || DEFAULT_MODEL;
    this.ocrModel = process.env.MISTRAL_OCR_MODEL?.trim() || DEFAULT_OCR_MODEL;
    this.debugEnabled =
      process.env.MISTRAL_DEBUG?.trim().toLowerCase() === "true";
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Dokument per Mistral-OCR in Text umwandeln und die Markdown-Seiten
   * zusammenfügen.
   *
   * @param debug optionaler Recorder, der Request/Response für den Debug-Dump mitschneidet
   */
  async ocr(
    input: MistralOcrRequest,
    debug?: MistralDebugRecorder,
  ): Promise<string> {
    const key = this.requireKey();
    const requestForDebug = {
      model: this.ocrModel,
      input: redactDocumentDataUrl(input),
    };

    let response: Response;

    try {
      response = await fetch(`${MISTRAL_API_BASE}/ocr`, {
        method: "POST",
        headers: authHeaders(key),
        body: ocrBody(this.ocrModel, input),
        signal: AbortSignal.timeout(MISTRAL_TIMEOUT_MS),
      });
    } catch (err) {
      debug?.record({
        step: "ocr",
        request: requestForDebug,
        response: null,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const error = await mistralError("OCR", response);
      debug?.record({
        step: "ocr",
        request: requestForDebug,
        response: null,
        error: error.message,
      });
      throw error;
    }

    const json = (await response.json()) as {
      pages?: Array<{ markdown?: string; text?: string }>;
    };

    debug?.record({
      step: "ocr",
      request: requestForDebug,
      response: json,
    });

    const pages = json.pages ?? [];
    return pages
      .map((p) => p.markdown ?? p.text ?? "")
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Chat-Completion mit erzwungenem JSON-Schema aufrufen und den rohen
   * Antwort-Inhalt zurückgeben
   *
   * @param debug optionaler Recorder, der Request/Response für den Debug-Dump mitschneidet
   */
  async chatJson(
    req: MistralChatRequest,
    debug?: MistralDebugRecorder,
  ): Promise<string> {
    const key = this.requireKey();

    let response: Response;

    try {
      response = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
        method: "POST",
        headers: authHeaders(key),
        body: chatBody(req),
        signal: AbortSignal.timeout(MISTRAL_TIMEOUT_MS),
      });
    } catch (err) {
      debug?.record({
        step: "chat",
        request: req,
        response: null,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const error = await mistralError("Chat", response);
      debug?.record({
        step: "chat",
        request: req,
        response: null,
        error: error.message,
      });
      throw error;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    debug?.record({ step: "chat", request: req, response: json });

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException(
        getI18n().t("errors.ai.noResponse"),
      );
    }

    return content;
  }

  /**
   * API-Key zurückgeben oder werfen, wenn die KI-Extraktion nicht
   * konfiguriert ist.
   */
  private requireKey(): string {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        getI18n().t("errors.ai.notConfigured"),
      );
    }

    return this.apiKey;
  }
}

const mistralLogger = new Logger("MistralClient");

/**
 * Bei Mistral Fehler ServiceUnavailableException werfen. Der rohe
 * Upstream-Body bleibt im Server-Log; die Client-Meldung nennt nur
 * Schritt und Status, um interne Details nicht preiszugeben.
 */
const mistralError = async (
  step: string,
  response: Response,
): Promise<Error> => {
  let body = "";

  try {
    body = await response.text();
  } catch {
    body = "";
  }

  mistralLogger.warn(
    `Mistral ${step} failed (${response.status}): ${body.slice(0, 500)}`,
  );

  return new ServiceUnavailableException(
    getI18n().t("errors.ai.upstreamError", {
      step,
      status: response.status,
    }),
  );
};
