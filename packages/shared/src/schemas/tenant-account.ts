import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { isoDate } from "./common.js";

/**
 * Mieterkonto-Schemas + Domain-Typen
 *
 * Saldo-Modell:
 * - Vier Zahlungszwecke (`month`, `statement`, `deposit`, `fee`)
 * - Pro Zweck hat jeder Topf einen Sollwert und einen Istwert.
 * - Status pro Topf: `open` (Mieter schuldet noch), `balanced` (Ist = Soll)
 *   oder `credit` (Mieter hat überzahlt bzw. Vermieter hat zu viel erstattet)
 *
 * Kaution wird im Mieter-Gesamtsaldo getrennt geführt (Sondervermögen)
 */

export const accountFeeCreateSchema = z
  .object({
    tenantId: z.guid(),
    date: isoDate(),
    // Positiv = Forderung (Soll), negativ = Gutschrift (Guthaben für den
    // Mieter, z. B. rückwirkende Korrektur). 0 ist bedeutungslos
    amountCents: z
      .number()
      .int()
      .refine((value) => value !== 0, messageKey("validation.required")),
    reason: z.string().min(1, messageKey("validation.required")).max(500),
  })
  .strict();
export type AccountFeeCreateDto = z.infer<typeof accountFeeCreateSchema>;

export const accountFeeUpdateSchema = accountFeeCreateSchema
  .partial()
  .omit({ tenantId: true });
export type AccountFeeUpdateDto = z.infer<typeof accountFeeUpdateSchema>;

export const potStatuses = ["open", "balanced", "credit"] as const;
export type PotStatus = (typeof potStatuses)[number];

/**
 * Pure Funktion: vergleicht Sollwert mit Istwert und liefert den
 * Topf-Status. Soll und Ist können beide signiert sein: bei negativen
 * Sollwerten (Vermieter schuldet, z. B. NK-Guthaben) ist "open" eine
 * noch ausstehende Erstattung.
 */
export const computeStatus = (
  sollCents: number,
  istCents: number,
): PotStatus => {
  if (sollCents === istCents) {
    return "balanced";
  }

  if (sollCents === 0) {
    return "credit";
  }

  const remaining = sollCents - istCents;

  if (Math.sign(remaining) === Math.sign(sollCents)) {
    return "open";
  }

  return "credit";
};

export type PotState = {
  sollCents: number;
  istCents: number;
  status: PotStatus;
};

/**
 * Eine Zeile in drt Mieteingangs-Tabelle für einen Mietmonat
 *
 * `paymentIds` enthält die IDs der Payments, die diesen Monat treffen
 * (mehrere möglich, falls Teilzahlungen erfasst wurden).
 */
export type MonthGridRow = {
  tenantId: string;
  forMonth: string; // YYYY-MM
  baseRent: PotState;
  advance: PotState;
  paymentIds: string[];
};

export type SettlementRow = {
  statementId: string;
  date: string; // YYYY-MM-DD
  pot: PotState;
  paymentIds: string[];
};

export type FeeRow = {
  feeId: string;
  date: string; // YYYY-MM-DD
  reason: string;
  pot: PotState;
  paymentIds: string[];
};

export type DepositRow = {
  pot: PotState;
  paymentIds: string[];
};

/**
 * Saldo-Aggregat über alle Zahlungszwecke eines Mieters. Kaution wird separat
 * ausgewiesen
 */
export type TenantBalanceResult = {
  tenantId: string;
  asOfDate: string;
  /**
   * Hauptsaldo
   */
  balanceCents: number;
  /**
   * Saldo des Kautions-Topfs (positiv = Mieter hat eingezahlt, soweit
   * erwartet)
   */
  depositBalanceCents: number;
};
