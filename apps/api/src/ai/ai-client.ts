import { ServiceUnavailableException } from "@nestjs/common";
import { getI18n } from "../i18n/i18n.registry.js";

export type AiDocumentInput = {
  documentDataUrl: string;
  mimeType: string;
  isImage: boolean;
};

export type AiChatRequest = {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
};

export type AiDebugEntry = {
  step: "ocr" | "chat";
  request: unknown;
  response: unknown;
  error?: string;
};

export type AiDebugRecorder = {
  record: (entry: AiDebugEntry) => void;
};

/**
 * Anbieter-unabhängige Schnittstelle für die Rechnungs-Extraktion: erst den
 * Text des Dokuments lesen, dann daraus strukturiertes JSON gewinnen.
 */
export type AiClient = {
  /**
   * Modellbezeichnung, wie sie im Debug-Dump auftaucht.
   */
  readonly model: string;
  /**
   * Wandelt ein Dokument in Fließtext (Markdown) um.
   */
  readonly transcribe: (
    input: AiDocumentInput,
    debug?: AiDebugRecorder,
  ) => Promise<string>;
  /**
   * Fordert eine Antwort an, die dem übergebenen JSON-Schema entspricht, und
   * gibt den rohen JSON-Text zurück.
   */
  readonly chatJson: (
    request: AiChatRequest,
    debug?: AiDebugRecorder,
  ) => Promise<string>;
};

export const AI_TIMEOUT_MS = 120_000;

/**
 * Maximale Antwortlänge. Großzügig, weil Sammelrechnungen viele Positionen
 * enthalten können.
 */
export const AI_MAX_OUTPUT_TOKENS = 16_000;

/**
 * Data-URL in ihre Bestandteile zerlegen. Die Anbieter erwarten teils die
 * komplette URL, teils nur die Base64-Nutzdaten.
 */
export const splitDataUrl = (
  dataUrl: string,
): { mediaType: string; base64: string } => {
  const match = /^data:([^;]+);base64,(.*)$/su.exec(dataUrl);
  if (!match?.[1] || match[2] === undefined) {
    throw new ServiceUnavailableException(getI18n().t("errors.ai.noResponse"));
  }

  return { mediaType: match[1], base64: match[2] };
};

/**
 * Zieht die Klartext-Meldung aus einer Anbieter-Fehlerantwort. Die Formate
 * gehen auseinander: OpenAI und Gemini nutzen `error.message` (Gemini
 * verpackt das zusätzlich in ein Array), Mistral antwortet mit `detail`,
 * andere mit einem blanken `message`.
 *
 * @returns `null`, wenn sich keine Meldung herauslösen lässt
 */
export const upstreamErrorDetail = (body: string): string | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  const entry = (Array.isArray(parsed) ? parsed[0] : parsed) as
    | {
        error?: { message?: unknown } | string;
        detail?: unknown;
        message?: unknown;
      }
    | undefined;

  const candidates = [
    typeof entry?.error === "object" ? entry.error?.message : entry?.error,
    entry?.detail,
    entry?.message,
  ];

  const detail = candidates.find(
    (value): value is string =>
      typeof value === "string" && value.trim() !== "",
  );

  return detail ?? null;
};

/**
 * Fehler eines Anbieters in eine ServiceUnavailableException übersetzen. Die
 * Meldung des Anbieters wird durchgereicht.
 */
export const aiUpstreamError = (
  step: string,
  status: number,
  logBody: (message: string) => void,
  body: string,
): Error => {
  logBody(`KI-Anbieter meldete Fehler (${step}, Status ${status}): ${body}`);
  const detail = upstreamErrorDetail(body);

  return new ServiceUnavailableException(
    detail
      ? getI18n().t("errors.ai.upstreamErrorDetail", { step, status, detail })
      : getI18n().t("errors.ai.upstreamError", { step, status }),
  );
};

/**
 * Wirft, wenn der Anbieter keinen verwertbaren Inhalt geliefert hat.
 */
export const requireContent = (content: string | undefined | null): string => {
  if (!content) {
    throw new ServiceUnavailableException(getI18n().t("errors.ai.noResponse"));
  }

  return content;
};
