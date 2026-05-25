import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { parseEurToCents } from "../format.js";
import { ISO_DATE_REGEX } from "./common.js";
import {
  type PaymentCreateDto,
  type PaymentPurposeKind,
  paymentPurposeKinds,
} from "./payments.js";

const amountRegex = /^-?\d+([.,]\d{1,2})?$/u;
const positiveAmountRegex = /^\d+([.,]\d{1,2})?$/u;
const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/u;

export const monthInputModes = ["sum", "split"] as const;
export type MonthInputMode = (typeof monthInputModes)[number];

/**
 * Form-Werte für eine Zahlung. Bei `purposeKind === "month"`:
 *
 * - `inputMode = "sum"`: User gibt nur die Gesamtsumme ein
 *   (`sumInput`). Die Aufteilung Kalt/NK übernimmt die Form aus dem
 *   Mietvertrag, sofern die eingegebene Summe genau der vertraglich
 *   geschuldeten Monatsmiete entspricht. Stimmt sie nicht, muss der
 *   User auf `split` wechseln.
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
        if (!positiveAmountRegex.test(data.sumInput)) {
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
      if (!positiveAmountRegex.test(data.baseRentInput)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseRentInput"],
          message: messageKey("ui.form.amountFormat"),
        });
      }

      if (!positiveAmountRegex.test(data.advanceInput)) {
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

    if (!amountRegex.test(data.amountInput)) {
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

  const amountCents = parseEurToCents(values.amountInput);

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
  sumInput: "",
  baseRentInput: "",
  advanceInput: "",
  amountInput: "",
});

/**
 * Helper: für eine Form-Eingabe im Modus "Summe" liefert er die
 * Aufteilung in Kalt + NK gemäß Vertragswerten, oder null, wenn die
 * Summe nicht zum Vertrag passt. Die PaymentForm verwendet das vor
 * dem Submit; Schema kennt die Vertragssumme nicht.
 */
export const splitSumByContract = (
  sumInput: string,
  contractBaseRentCents: number,
  contractAdvanceCents: number,
): { baseRentCents: number; advanceCents: number } | null => {
  const sumCents = parseEurToCents(sumInput);

  if (sumCents !== contractBaseRentCents + contractAdvanceCents) {
    return null;
  }

  return {
    baseRentCents: contractBaseRentCents,
    advanceCents: contractAdvanceCents,
  };
};
