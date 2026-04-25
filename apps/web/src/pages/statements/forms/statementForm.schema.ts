import { z } from "zod";
import { t } from "../../../lib/i18n";

export const statementFormSchema = z.object({
  buildingId: z.string().min(1, t("ui.statements.validation.buildingRequired")),
  tenantId: z.string().min(1, t("ui.statements.validation.tenantRequired")),
  periodStart: z.string().min(1, t("ui.costs.validation.periodStartRequired")),
  periodEnd: z.string().min(1, t("ui.costs.validation.periodEndRequired")),
  documentDate: z
    .string()
    .min(1, t("ui.statements.validation.documentDateRequired")),
});

export type StatementFormValues = z.infer<typeof statementFormSchema>;

export type StatementSubmitValues = {
  buildingId: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  documentDate: string;
};
