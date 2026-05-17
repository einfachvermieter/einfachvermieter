import { z } from "zod";
import { isoDate } from "./common.js";

/**
 * Zahlungsbewegungen auf dem Mieterkonto. Jede Bewegung hat genau einen
 * Zahlungszweck - sie sagt, wofür gezahlt wird. Vier Zwecke sind möglich:
 *
 * - `month`: laufende Miete eines Mietmonats (YYYY-MM). Hat zwei Töpfe:
 *   `baseRentCents` (Kaltmiete) und `advanceCents` (NK-Vorauszahlung).
 * - `statement`: Nachzahlung/Erstattung zu einer NK-Abrechnung.
 * - `deposit`: Kautionseingang oder -rückzahlung.
 * - `fee`: Tilgung einer Mahn-/Rücklaufgebühr.
 */
export const paymentPurposeKinds = [
  "month",
  "statement",
  "deposit",
  "fee",
] as const;
export type PaymentPurposeKind = (typeof paymentPurposeKinds)[number];

const monthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/u;
export const monthKey = () =>
  z.string().regex(monthKeyRegex, "expected YYYY-MM");

const monthPayloadSchema = z
  .object({
    kind: z.literal("month"),
    forMonth: monthKey(),
    baseRentCents: z.number().int(),
    advanceCents: z.number().int(),
  })
  .strict();

const statementPayloadSchema = z
  .object({
    kind: z.literal("statement"),
    forStatementId: z.guid(),
    amountCents: z
      .number()
      .int()
      .refine((value) => value !== 0, { message: "amount must not be zero" }),
  })
  .strict();

const depositPayloadSchema = z
  .object({
    kind: z.literal("deposit"),
    amountCents: z
      .number()
      .int()
      .refine((value) => value !== 0, { message: "amount must not be zero" }),
  })
  .strict();

const feePayloadSchema = z
  .object({
    kind: z.literal("fee"),
    forFeeId: z.guid(),
    amountCents: z
      .number()
      .int()
      .refine((value) => value !== 0, { message: "amount must not be zero" }),
  })
  .strict();

export const paymentPurposeSchema = z.discriminatedUnion("kind", [
  monthPayloadSchema,
  statementPayloadSchema,
  depositPayloadSchema,
  feePayloadSchema,
]);
export type PaymentPurpose = z.infer<typeof paymentPurposeSchema>;

export const paymentCreateSchema = z
  .object({
    tenantId: z.guid(),
    paymentDate: isoDate(),
    reference: z.string().max(500).optional().nullable(),
    purpose: paymentPurposeSchema,
  })
  .strict();
export type PaymentCreateDto = z.infer<typeof paymentCreateSchema>;

export const paymentUpdateSchema = z
  .object({
    paymentDate: isoDate().optional(),
    reference: z.string().max(500).optional().nullable(),
    purpose: paymentPurposeSchema.optional(),
  })
  .strict();
export type PaymentUpdateDto = z.infer<typeof paymentUpdateSchema>;
