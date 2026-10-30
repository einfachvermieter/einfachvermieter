import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { parseEurToCents, unsignedAmountRegex } from "../format.js";
import { ISO_DATE_REGEX } from "./common.js";
import {
  type PaymentCreateDto,
  type PaymentPurposeKind,
  paymentPurposeKinds,
} from "./payments.js";

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/u;

export const monthInputModes = ["sum", "split"] as const;
export type MonthInputMode = (typeof monthInputModes)[number];

/**
 * Richtung einer Zahlung außerhalb der Monatsmiete: vom Mieter erhalten
 * oder an ihn ausgezahlt (Erstattung, Kautionsrückzahlung)
 */
export const paymentDirections = ["received", "paidOut"] as const;
export type PaymentDirection = (typeof paymentDirections)[number];

/**
 * Form-Werte für eine Zahlung. Bei `purposeKind === "month"`:
 *
 * - `inputMode = "sum"`: User gibt nur die Gesamtsumme ein
 *   (`sumInput`). Das Formular verteilt sie mit `distributeMonthSum` auf
 *   den offenen Betrag des Monats.
 * - `inputMode = "split"`: User gibt Kaltmiete und NK-Voraus getrennt
 *   ein (`baseRentInput` + `advanceInput`).
 */
export const paymentFormSchema = z
  .object({
    tenantId: z.string().min(1, messageKey("ui.form.tenantRequired")),
    paymentDate: z
      .string()
      .min(1, messageKey("ui.form.dateRequired"))
      .regex(ISO_DATE_REGEX, messageKey("ui.form.dateFormat")),
    reference: z.string().max(500),
    purposeKind: z.enum(paymentPurposeKinds),
    forMonth: z.string(),
    forStatementId: z.string(),
    forFeeId: z.string(),
    inputMode: z.enum(monthInputModes),
    direction: z.enum(paymentDirections),
    sumInput: z.string(),
    baseRentInput: z.string(),
    advanceInput: z.string(),
    amountInput: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.purposeKind === "month") {
      if (!monthRegex.test(data.forMonth)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["forMonth"],
          message: messageKey("ui.payments.validation.monthRequired"),
        });
      }

      if (data.inputMode === "sum") {
        if (!unsignedAmountRegex.test(data.sumInput)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sumInput"],
            message: messageKey("ui.form.amountFormat"),
          });
          return;
        }

        if (parseEurToCents(data.sumInput) === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sumInput"],
            message: messageKey("ui.payments.validation.amountRequired"),
          });
        }

        return;
      }
      // split-Modus: getrennt Kaltmiete + NK validieren
      if (!unsignedAmountRegex.test(data.baseRentInput)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseRentInput"],
          message: messageKey("ui.form.amountFormat"),
        });
      }

      if (!unsignedAmountRegex.test(data.advanceInput)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["advanceInput"],
          message: messageKey("ui.form.amountFormat"),
        });
      }

      const sum =
        parseEurToCents(data.baseRentInput || "0") +
        parseEurToCents(data.advanceInput || "0");

      if (sum === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseRentInput"],
          message: messageKey("ui.payments.validation.amountRequired"),
        });
      }

      return;
    }

    if (data.purposeKind === "statement" && !data.forStatementId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["forStatementId"],
        message: messageKey("ui.payments.validation.statementRequired"),
      });
    }

    if (data.purposeKind === "fee" && !data.forFeeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["forFeeId"],
        message: messageKey("ui.payments.validation.feeRequired"),
      });
    }

    if (!unsignedAmountRegex.test(data.amountInput)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountInput"],
        message: messageKey("ui.form.amountFormat"),
      });

      return;
    }

    if (parseEurToCents(data.amountInput) === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountInput"],
        message: messageKey("ui.payments.validation.amountRequired"),
      });
    }
  });

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export const paymentFormToDto = (
  values: PaymentFormValues,
): PaymentCreateDto => {
  const base = {
    tenantId: values.tenantId,
    paymentDate: values.paymentDate,
    reference: values.reference.trim() || null,
  };
  if (values.purposeKind === "month") {
    return {
      ...base,
      purpose: {
        kind: "month",
        forMonth: values.forMonth,
        baseRentCents: parseEurToCents(values.baseRentInput || "0"),
        advanceCents: parseEurToCents(values.advanceInput || "0"),
      },
    };
  }

  const magnitude = parseEurToCents(values.amountInput);
  const amountCents = values.direction === "paidOut" ? -magnitude : magnitude;

  if (values.purposeKind === "statement") {
    return {
      ...base,
      purpose: {
        kind: "statement",
        forStatementId: values.forStatementId,
        amountCents,
      },
    };
  }

  if (values.purposeKind === "deposit") {
    return {
      ...base,
      purpose: { kind: "deposit", amountCents },
    };
  }

  return {
    ...base,
    purpose: { kind: "fee", forFeeId: values.forFeeId, amountCents },
  };
};

export const emptyPaymentFormValues = (overrides: {
  tenantId?: string;
  paymentDate?: string;
  purposeKind?: PaymentPurposeKind;
  forMonth?: string;
}): PaymentFormValues => ({
  tenantId: overrides.tenantId ?? "",
  paymentDate: overrides.paymentDate ?? "",
  reference: "",
  purposeKind: overrides.purposeKind ?? "month",
  forMonth: overrides.forMonth ?? "",
  forStatementId: "",
  forFeeId: "",
  inputMode: "sum",
  direction: "received",
  sumInput: "",
  baseRentInput: "",
  advanceInput: "",
  amountInput: "",
});

/**
 * Verteilt eine Gesamtsumme innerhalb eines Monats: zuerst auf die offene
 * NK-Vorauszahlung, der Rest auf die offene Kaltmiete (BGH VIII ZR 68/17,
 * ohne Tilgungsbestimmung des Mieters). Liegt die Summe über dem offenen
 * Betrag des Monats, gibt es kein Ergebnis
 */
export const distributeMonthSum = (
  sumCents: number,
  openAdvanceCents: number,
  openBaseRentCents: number,
): { baseRentCents: number; advanceCents: number } | null => {
  if (sumCents > openAdvanceCents + openBaseRentCents) {
    return null;
  }

  const advanceCents = Math.min(sumCents, openAdvanceCents);
  return { advanceCents, baseRentCents: sumCents - advanceCents };
};

/**
 * Offener Betrag eines Topfs, nie unter 0: eine Überzahlung mindert den
 * anderen Topf nicht
 */
export const openPotCents = (sollCents: number, istCents: number): number =>
  Math.max(0, sollCents - istCents);
