import {
  type AiExtractionItem,
  attachmentMaxBytesFromEnv,
  type CostEntryExtractionResult,
} from "@einfachvermieter/shared";
import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { assertUploadAllowed } from "../common/upload-guard.js";
import { AttachmentsService } from "../costs/attachments.service.js";
import { CostsService } from "../costs/costs.service.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { debugKeyFor, StorageService } from "../storage/storage.service.js";
import {
  MistralClient,
  type MistralDebugEntry,
  type MistralDebugRecorder,
} from "./mistral-client.provider.js";
import {
  buildSystemPrompt,
  COST_ENTRY_EXTRACTION_JSON_SCHEMA,
  type CostTypeForPrompt,
  computeGrossCents,
  type MistralRawItem,
  type MistralRawResult,
  mistralRawResultSchema,
  USER_INSTRUCTION,
} from "./prompts.js";

const MAX_ATTACHMENT_BYTES = attachmentMaxBytesFromEnv(process.env);

const MISTRAL_SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Prüfen, ob der MIME-Typ ein Bild bezeichnet.
 */
const isImageMime = (mimeType: string): boolean =>
  mimeType.startsWith("image/");

export type ExtractFromBufferInput = {
  buffer: Buffer;
  mimeType: string;
  buildingId?: string;
};

export type ExtractFromAttachmentInput = {
  costEntryId: string;
  attachmentId: string;
  buildingId?: string;
};

type ExtractionContext = {
  /**
   * Storage-Pfad der Datei; daneben wird die `.debug`-Datei abgelegt.
   */
  storageKey: string;
  /**
   * DB-Anhangs-Id, falls die Zeile schon existiert (Edit): dann wird der
   * OCR-Text direkt gespeichert, sonst an den Client zurückgegeben.
   */
  attachmentId: string | null;
};

const EXTRACTION_UPLOAD_DIR = "_extractions";

/**
 * Toleranz für Brutto-Summen-Validierung durch positionsweise Rundung.
 * Alles darüber wird als semantisch falscher Wert betrachtet.
 */
const TOTAL_TOLERANCE_CENTS = 2;

/**
 * Brutto-Summe aller Positionen in Cent bilden
 */
const sumItemGrossCents = (items: MistralRawItem[]): number =>
  items.reduce((sum, item) => sum + (computeGrossCents(item) ?? 0), 0);

/**
 * Liefert die Differenz `Bruttosumme - invoiceTotalCents`, oder `null` wenn
 * keine Validierung möglich ist (kein invoiceTotalCents oder keine Items).
 * Die Summe wird aus den Roh-Feldern (Netto + USt bzw. Brutto) berechnet,
 * nicht aus einer LLM-Multiplikation übernommen.
 */
const sumMismatch = (result: MistralRawResult): number | null => {
  if (result.invoiceTotalCents === null) {
    return null;
  }

  if (result.items.length === 0) {
    return null;
  }

  return sumItemGrossCents(result.items) - result.invoiceTotalCents;
};

/**
 * Bildet die Roh-Mistral-Antwort auf die öffentliche Client-API ab. Pro
 * Position wird der Brutto-Betrag im Backend berechnet.
 */
const mapRawItemsToPublic = (items: MistralRawItem[]): AiExtractionItem[] =>
  items.map((item) => ({
    description: item.description,
    amountCents: computeGrossCents(item),
    unitPriceCents: item.unitPriceCents,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    costTypeId: item.costTypeId,
    costTypeMatchReason: item.costTypeMatchReason,
  }));

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

@Injectable()
export class AiExtractionService {
  private readonly logger = new Logger(AiExtractionService.name);

  constructor(
    private readonly mistral: MistralClient,
    private readonly costsService: CostsService,
    private readonly attachmentsService: AttachmentsService,
    private readonly storage: StorageService,
  ) {}

  isConfigured(): boolean {
    return this.mistral.isConfigured();
  }

  /**
   * Rechnung aus einem rohen Datei-Buffer extrahieren (Create-Flow, ohne
   * bestehende Anhangs-Zeile). Bei aktiviertem Debug wird die Datei vorab unter
   * einer UUID abgelegt, damit der Debug-Dump daneben landen kann.
   */
  async extractFromBuffer(
    input: ExtractFromBufferInput,
  ): Promise<CostEntryExtractionResult> {
    let ctx: ExtractionContext | null = null;
    if (this.mistral.isDebugEnabled()) {
      // Datei unter UUID in einen separaten Ordner ablegen, damit das
      // .debug-File daneben landen kann. Beim Neu-anlegen gibt es noch keine
      // Anhangs-Zeile, also kein DB-Cache, nur die Datei + .debug.
      const fileId = crypto.randomUUID();

      const ext =
        MIME_TO_EXT[input.mimeType] ??
        input.mimeType.split("/")[1]?.replace(/[^a-z0-9]/giu, "") ??
        "bin";

      const storageKey = `${EXTRACTION_UPLOAD_DIR}/${fileId}.${ext}`;

      try {
        await this.storage.write(storageKey, input.buffer);
      } catch (err) {
        this.logger.warn(
          `Konnte Upload für Debug nicht ablegen (${storageKey}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }

      ctx = { storageKey, attachmentId: null };
    }

    return this.extract(input, ctx);
  }

  /**
   * Rechnung aus einem bereits gespeicherten Anhang extrahieren
   */
  async extractFromAttachment(
    input: ExtractFromAttachmentInput,
  ): Promise<CostEntryExtractionResult> {
    const { attachment, data } = await this.attachmentsService.loadFile(
      input.costEntryId,
      input.attachmentId,
    );
    return this.extract(
      {
        buffer: data,
        mimeType: attachment.mimeType,
        buildingId: input.buildingId,
      },
      {
        attachmentId: attachment.id,
        storageKey: attachment.storageKey,
      },
    );
  }

  /**
   * OCR, KI-Auslesen, Brutto-Validierung gegen den Endbetrag
   * (mit einmaligem Korrektur-Retry) und Mapping auf die Client-API.
   *
   * @param ctx Storage-/Anhangs-Kontext für OCR-Persistenz und Debug-Dump. Null, wenn beides entfällt
   */
  private async extract(
    input: ExtractFromBufferInput,
    ctx: ExtractionContext | null,
  ): Promise<CostEntryExtractionResult> {
    assertUploadAllowed(
      input.mimeType,
      input.buffer.length,
      MISTRAL_SUPPORTED_MIME_TYPES,
      MAX_ATTACHMENT_BYTES,
    );

    const costTypes = (await this.costsService.listAllCostTypes(
      input.buildingId,
    )) as Array<{
      id: string;
      name: string;
      category: "operating" | "heating";
    }>;

    const warnings: string[] = [];
    if (costTypes.length === 0) {
      warnings.push(getI18n().t("warnings.aiNoCostTypes"));
    }

    const debugWanted = this.mistral.isDebugEnabled() && ctx !== null;
    const debugEntries: MistralDebugEntry[] = [];
    const recorder: MistralDebugRecorder | undefined = debugWanted
      ? { record: (entry) => debugEntries.push(entry) }
      : undefined;

    try {
      const dataUrl = `data:${input.mimeType};base64,${input.buffer.toString("base64")}`;
      const ocrText = await this.mistral.ocr(
        {
          documentDataUrl: dataUrl,
          isImage: isImageMime(input.mimeType),
        },
        recorder,
      );
      if (ocrText.trim() && ctx?.attachmentId) {
        // Bearbeitung: Anhangs-Zeile existiert bereits -> OCR direkt ablegen
        // (überschreibt ggf. einen früheren Wert)
        await this.attachmentsService.setOcrText(ctx.attachmentId, ocrText);
      }

      if (!ocrText.trim()) {
        throw new BadGatewayException(getI18n().t("errors.ai.noText"));
      }

      const promptCostTypes: CostTypeForPrompt[] = costTypes.map((ct) => ({
        id: ct.id,
        name: ct.name,
        category: ct.category,
      }));

      const systemPrompt = buildSystemPrompt(promptCostTypes);
      const userPrompt = `${USER_INSTRUCTION}\n\n--- Rechnungstext ---\n${ocrText}`;

      const firstJson = await this.mistral.chatJson(
        {
          model: this.mistral.getModel(),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          jsonSchema: COST_ENTRY_EXTRACTION_JSON_SCHEMA,
        },
        recorder,
      );

      const raw = await this.revalidateGrossWithRetry(
        this.parseAndValidate(firstJson),
        { systemPrompt, userPrompt, firstJson, recorder, warnings },
      );

      const publicItems = mapRawItemsToPublic(raw.items);
      const validIds = new Set(costTypes.map((ct) => ct.id));
      const sanitizedItems = publicItems.map((item, index) => {
        if (item.costTypeId && !validIds.has(item.costTypeId)) {
          warnings.push(
            getI18n().t("warnings.aiUnknownCostType", {
              position: index + 1,
            }),
          );
          return { ...item, costTypeId: null };
        }
        return item;
      });

      return {
        vendor: raw.vendor,
        invoiceNumber: raw.invoiceNumber,
        invoiceDate: raw.invoiceDate,
        invoiceTotalCents: raw.invoiceTotalCents,
        items: sanitizedItems,
        warnings: [...raw.warnings, ...warnings],
        ocrText,
      };
    } finally {
      if (debugWanted && ctx && debugEntries.length > 0) {
        await this.writeDebugDump(ctx.storageKey, debugEntries);
      }
    }
  }

  /**
   * Brutto-Validierung gegen invoiceTotalCents: weicht die Positionssumme um
   * mehr als TOTAL_TOLERANCE_CENTS ab, einmaliger Korrektur-Retry. Bleibt es
   * daneben, die Variante mit der geringeren Abweichung nehmen und warnen.
   */
  private async revalidateGrossWithRetry(
    raw: MistralRawResult,
    ctx: {
      systemPrompt: string;
      userPrompt: string;
      firstJson: string;
      recorder: MistralDebugRecorder | undefined;
      warnings: string[];
    },
  ): Promise<MistralRawResult> {
    const firstDiff = sumMismatch(raw);
    if (firstDiff === null || Math.abs(firstDiff) <= TOTAL_TOLERANCE_CENTS) {
      return raw;
    }

    const sumCents = sumItemGrossCents(raw.items);
    const totalCents = raw.invoiceTotalCents ?? 0;
    const correctionPrompt = [
      ctx.userPrompt,
      "",
      "--- Vorherige Antwort (FEHLERHAFT) ---",
      ctx.firstJson,
      "",
      "--- Korrektur erforderlich ---",
      "Das Backend hat aus deinen Roh-Werten die Brutto-Summe der",
      `Positionen berechnet: ${sumCents} ct. Der Brutto-Endbetrag der`,
      `Rechnung ist jedoch ${totalCents} ct (invoiceTotalCents).`,
      `Differenz: ${firstDiff} ct.`,
      "Da die Brutto-Umrechnung im Backend deterministisch erfolgt,",
      "ist die Diskrepanz nicht durch einen Rechenfehler entstanden.",
      "Mögliche Ursachen: (a) für eine Position wurde ein Tarif statt",
      "des abgerechneten Betrags übernommen, (b) eine Position fehlt",
      "oder ist doppelt vorhanden, (c) der falsche taxRateBps wurde",
      "gewählt, (d) invoiceTotalCents wurde aus einem anderen Zeile",
      "übernommen (z. B. Abschlagssumme statt Brutto-Endbetrag),",
      "(e) bei einer Versicherungsrechnung wurde der Nettobeitrag mit",
      "taxRateBps=0 statt des Bruttoabrechnungsbeitrags übernommen –",
      "Versicherungsbeiträge sind zwar umsatzsteuerfrei, enthalten aber",
      "Versicherungssteuer (VersStG); IMMER den Bruttoabrechnungsbeitrag",
      "als amountGrossCents nehmen. Die Versicherungssteuer NICHT als",
      "eigene Position anlegen – sie ist im Brutto bereits enthalten.",
      "Bitte gib eine korrigierte JSON-Antwort gemäß Schema zurück.",
    ].join("\n");

    const retryJson = await this.mistral.chatJson(
      {
        model: this.mistral.getModel(),
        messages: [
          { role: "system", content: ctx.systemPrompt },
          { role: "user", content: correctionPrompt },
        ],
        jsonSchema: COST_ENTRY_EXTRACTION_JSON_SCHEMA,
      },
      ctx.recorder,
    );

    const retryRaw = this.parseAndValidate(retryJson);
    const retryDiff = sumMismatch(retryRaw);
    if (retryDiff === null || Math.abs(retryDiff) <= TOTAL_TOLERANCE_CENTS) {
      return retryRaw;
    }

    // Retry hat es immer noch nicht hinbekommen.
    // Variante mit geringerer Abweichung nehmen und Warning anhängen.
    const corrected =
      Math.abs(retryDiff) < Math.abs(firstDiff) ? retryRaw : raw;
    const finalDiff = sumMismatch(corrected) ?? 0;
    ctx.warnings.push(
      getI18n().t("warnings.aiGrossMismatch", { diffCents: finalDiff }),
    );
    return corrected;
  }

  /**
   * Mistral-JSON parsen und gegen das Schema validieren; werfen, wenn eine
   * Position weder Netto- noch Brutto-Betrag enthält.
   */
  private parseAndValidate(chatJson: string): MistralRawResult {
    let parsed: unknown;

    try {
      parsed = JSON.parse(chatJson);
    } catch (err) {
      throw new BadGatewayException(getI18n().t("errors.ai.invalidJson"), {
        cause: err,
      });
    }

    const validated = mistralRawResultSchema.safeParse(parsed);
    if (!validated.success) {
      throw new BadGatewayException(getI18n().t("errors.ai.schemaMismatch"));
    }

    // Pro Position muss genau einer der Beträge gesetzt sein. Wir tolerieren
    // beide gesetzt (Brutto gewinnt, siehe computeGrossCents) und werfen nur,
    // wenn beide null sind.
    for (const item of validated.data.items) {
      if (item.amountNetCents === null && item.amountGrossCents === null) {
        throw new BadGatewayException(
          getI18n().t("errors.ai.itemMissingAmount", {
            description: item.description,
          }),
        );
      }
    }

    return validated.data;
  }

  /**
   * Mistral-Debug-Einträge als JSON-Datei neben der Quelldatei ablegen.
   */
  private async writeDebugDump(
    storageKey: string,
    entries: MistralDebugEntry[],
  ): Promise<void> {
    const dump = {
      timestamp: new Date().toISOString(),
      sourceStorageKey: storageKey,
      ocrModel: process.env.MISTRAL_OCR_MODEL?.trim() || "mistral-ocr-latest",
      chatModel: this.mistral.getModel(),
      entries,
    };

    const debugKey = debugKeyFor(storageKey);

    try {
      await this.storage.write(
        debugKey,
        Buffer.from(`${JSON.stringify(dump, null, 2)}\n`, "utf8"),
      );
    } catch (err) {
      this.logger.warn(
        `Konnte Mistral-Debug-Datei nicht schreiben (${debugKey}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
