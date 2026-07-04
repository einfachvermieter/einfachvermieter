import { z } from "zod";
import { isoDate } from "./common.js";

export const aiExtractionItemSchema = z.object({
  description: z.string(),
  amountCents: z.number().int().nonnegative().nullable(),
  /**
   * Optionaler Einheitspreis. Wird nur für den Tarifvergleich zwischen
   * Abrechnungszeiträumen verwendet, nicht für die Umlage-Berechnung selbst.
   */
  unitPriceCents: z.number().int().nonnegative().nullable(),
  periodStart: isoDate().nullable(),
  periodEnd: isoDate().nullable(),
  costTypeId: z.string().nullable(),
  costTypeMatchReason: z.string(),
});

export const costEntryExtractionResultSchema = z.object({
  vendor: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: isoDate().nullable(),
  /**
   * Brutto-Endbetrag der gesamten Rechnung in Cent. Nicht persistiert, dient
   * nur als Validierungs-Zahlungszweck für die Summe der Positionen.
   */
  invoiceTotalCents: z.number().int().nonnegative().nullable(),
  items: z.array(aiExtractionItemSchema),
  warnings: z.array(z.string()),
  /**
   * Roher OCR-Text der Datei (Mistral OCR). Wird vom Server nach erfolgreicher
   * Extraktion angefügt - nicht vom LLM erzeugt.
   */
  ocrText: z.string().default(""),
});

export type AiExtractionItem = z.infer<typeof aiExtractionItemSchema>;
export type CostEntryExtractionResult = z.infer<
  typeof costEntryExtractionResultSchema
>;

export const aiConfigSchema = z.object({
  mistralConfigured: z.boolean(),
});

export type AiConfig = z.infer<typeof aiConfigSchema>;
