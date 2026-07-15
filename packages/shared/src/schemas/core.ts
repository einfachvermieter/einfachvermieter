import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { isoDatePlusOneYear } from "../date.js";
import {
  costTypeAllocationKeys,
  costTypeCategories,
  isoDate,
  laborCostCategories,
} from "./common.js";

const costTypeFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(costTypeCategories),
  /**
   * Pflicht bei `category = "operating"`, muss bei `category = "heating"`
   * `null` sein (Heizkosten laufen über die Heizkostenkonfiguration).
   */
  defaultAllocationKey: z.enum(costTypeAllocationKeys).nullable(),
  /**
   * Optionale Begünstigungs-Kategorie (Handwerker / haushaltsnahe DL)
   */
  laborCostCategory: z.enum(laborCostCategories).nullable(),
  /**
   * Markiert die Brennstoff-Kostenart, deren Rechnungspositionen CO2-Menge
   * und enthaltenen CO2-Kostenanteil erfassen. Nur bei `category =
   * "heating"` zulässig.
   */
  co2Tracked: z.boolean().optional().default(false),
  description: z.string().max(1000).optional().nullable(),
});

export const costTypeCreateSchema = costTypeFieldsSchema
  .extend({ buildingId: z.guid() })
  .strict()
  .refine(
    (data) =>
      data.category !== "operating" || data.defaultAllocationKey !== null,
    {
      message: messageKey("ui.costs.validation.allocationKeyRequired"),
      path: ["defaultAllocationKey"],
    },
  )
  .refine(
    (data) => data.category !== "heating" || data.defaultAllocationKey === null,
    {
      message: messageKey("ui.costs.validation.allocationKeyForbidden"),
      path: ["defaultAllocationKey"],
    },
  )
  .refine((data) => data.category === "heating" || !data.co2Tracked, {
    message: messageKey("ui.costs.validation.co2TrackedHeatingOnly"),
    path: ["co2Tracked"],
  });
export type CostTypeCreateDto = z.infer<typeof costTypeCreateSchema>;

export const costTypeUpdateSchema = costTypeFieldsSchema
  .strict()
  .refine(
    (data) =>
      data.category !== "operating" || data.defaultAllocationKey !== null,
    {
      message: messageKey("ui.costs.validation.allocationKeyRequired"),
      path: ["defaultAllocationKey"],
    },
  )
  .refine(
    (data) => data.category !== "heating" || data.defaultAllocationKey === null,
    {
      message: messageKey("ui.costs.validation.allocationKeyForbidden"),
      path: ["defaultAllocationKey"],
    },
  )
  .refine((data) => data.category === "heating" || !data.co2Tracked, {
    message: messageKey("ui.costs.validation.co2TrackedHeatingOnly"),
    path: ["co2Tracked"],
  });
export type CostTypeUpdateDto = z.infer<typeof costTypeUpdateSchema>;

export const costEntryItemSchema = z
  .object({
    costTypeId: z.guid(),
    /**
     * Direktzuordnung an eine Wohnung.
     */
    unitId: z.guid().optional().nullable(),
    amountCents: z.number().int().positive(),
    /**
     * Optionaler Einheitspreis in Cent pro Einheit (m3/kWh). Wird für den
     * Tarifvergleich zwischen Perioden genutzt.
     */
    unitPriceCents: z.number().int().nonnegative().optional().nullable(),
    /**
     * Lohnkostenanteil in Cent (brutto). Muss zwischen 0 und `amountCents`
     * liegen.
     */
    laborCostsCents: z.number().int().nonnegative().optional().nullable(),
    /**
     * CO2-Menge in Gramm (Integer). Im UI in kg ein-/ausgegeben.
     */
    co2AmountGrams: z.number().int().nonnegative().optional().nullable(),
    /**
     * Im `amountCents` enthaltener CO2-Kostenanteil in Cent (kein zusätzlicher
     * Betrag). Muss zwischen 0 und `amountCents` liegen.
     */
    co2CostCents: z.number().int().nonnegative().optional().nullable(),
    periodStart: isoDate(),
    periodEnd: isoDate(),
  })
  .refine((d) => d.periodStart <= d.periodEnd, {
    message: messageKey("ui.costs.validation.periodOrder"),
    path: ["periodEnd"],
  })
  .refine(
    (d) =>
      d.laborCostsCents === null ||
      d.laborCostsCents === undefined ||
      d.laborCostsCents <= d.amountCents,
    {
      message: messageKey("ui.costs.validation.laborExceedsAmount"),
      path: ["laborCostsCents"],
    },
  )
  .refine(
    (d) =>
      d.co2CostCents === null ||
      d.co2CostCents === undefined ||
      d.co2CostCents <= d.amountCents,
    {
      message: messageKey("ui.costs.validation.co2CostExceedsAmount"),
      path: ["co2CostCents"],
    },
  );
export type CostEntryItemDto = z.infer<typeof costEntryItemSchema>;

export const costEntryCreateSchema = z
  .object({
    invoiceDate: isoDate(),
    invoiceNumber: z.string().max(100).optional().nullable(),
    vendor: z.string().max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    items: z
      .array(costEntryItemSchema)
      .min(1, messageKey("ui.costs.validation.itemsMin")),
  })
  .strict();

export type CostEntryCreateDto = z.infer<typeof costEntryCreateSchema>;

export const costEntryUpdateSchema = z
  .object({
    invoiceDate: isoDate().optional(),
    invoiceNumber: z.string().max(100).optional().nullable(),
    vendor: z.string().max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    items: z
      .array(costEntryItemSchema)
      .min(1, messageKey("ui.costs.validation.itemsMin"))
      .optional(),
  })
  .strict();

export type CostEntryUpdateDto = z.infer<typeof costEntryUpdateSchema>;

export const operatingCostStatementCreateSchema = z
  .object({
    buildingId: z.guid(),
    tenantId: z.guid(),
    periodStart: isoDate(),
    periodEnd: isoDate(),
    documentDate: isoDate().optional(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .strict()
  .refine((d) => d.periodStart < d.periodEnd, {
    message: "periodStart muss < periodEnd sein",
  })
  .refine((d) => d.periodEnd < isoDatePlusOneYear(d.periodStart), {
    message: messageKey("ui.statements.validation.periodMax12Months"),
    path: ["periodEnd"],
  });

export type OperatingCostStatementCreateDto = z.infer<
  typeof operatingCostStatementCreateSchema
>;

/**
 * Patch-Schema für die optionale Anpassung der monatlichen NK-Vorauszahlung
 * an einer Draft-Abrechnung. Beide Felder werden zusammen gesetzt oder
 * zusammen gelöscht. Halbzustände (Betrag ohne Datum oder umgekehrt)
 * sind nicht erlaubt.
 */
export const operatingCostStatementAdvanceAdjustmentSchema = z
  .object({
    adjustedMonthlyAdvanceCents: z.number().int().positive().nullable(),
    adjustedAdvanceValidFrom: isoDate().nullable(),
    /**
     * Optionale Tarif-Erwartungswerte pro Kostenart in Basispunkten
     * (100 bps = 1 %). `null` -> unverändert lassen / nicht ändern.
     * Leeres Objekt `{}` -> explizit alle Tarif-Erwartungen löschen.
     */
    tariffAdjustmentBps: z.record(z.string(), z.number().int()).nullable(),
  })
  .strict()
  .refine(
    (d) =>
      (d.adjustedMonthlyAdvanceCents === null &&
        d.adjustedAdvanceValidFrom === null) ||
      (d.adjustedMonthlyAdvanceCents !== null &&
        d.adjustedAdvanceValidFrom !== null),
    {
      message: messageKey("ui.statements.validation.adjustmentBothOrNone"),
      path: ["adjustedAdvanceValidFrom"],
    },
  );
export type OperatingCostStatementAdvanceAdjustmentDto = z.infer<
  typeof operatingCostStatementAdvanceAdjustmentSchema
>;

/**
 * Body zum Stornieren einer finalisierten Abrechnung. Der Grund ist Pflicht
 * (revisionssichere Dokumentation, warum die Abrechnung zurückgenommen wurde)
 * und wird am Datensatz festgehalten.
 */
export const operatingCostStatementCancelSchema = z
  .object({
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export type OperatingCostStatementCancelDto = z.infer<
  typeof operatingCostStatementCancelSchema
>;
