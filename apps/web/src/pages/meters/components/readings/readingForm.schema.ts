import { type MeterReadBy, meterReadBySources } from "@einfachvermieter/shared";
import { z } from "zod";
import { t } from "../../../../lib/i18n";

const decimalRegex = /^\d+([.,]\d+)?$/u;

export const readingFormSchema = z.object({
  readingDate: z.string().min(1, t("ui.form.dateRequired")),
  value: z.string().regex(decimalRegex, t("ui.form.numberRequired")),
  isEstimated: z.boolean(),
  readBy: z.enum(meterReadBySources),
  notes: z.string(),
});

export type ReadingFormValues = z.infer<typeof readingFormSchema>;

export type ReadingSubmitValues = {
  readingDate: string;
  value: number;
  isEstimated: boolean;
  readBy: MeterReadBy;
  notes: string | null;
};

export const readingFormToSubmit = (
  values: ReadingFormValues,
): ReadingSubmitValues => ({
  readingDate: values.readingDate,
  value: Number.parseFloat(values.value.replace(",", ".")),
  isEstimated: values.isEstimated,
  readBy: values.readBy,
  notes: values.notes.trim() ? values.notes : null,
});
