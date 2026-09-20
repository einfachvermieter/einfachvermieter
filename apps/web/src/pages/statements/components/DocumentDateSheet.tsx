import { isAdvanceValidFromRetroactive } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiCalendarEventLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { api } from "../../../lib/api";
import { t } from "../../../lib/i18n";
import { useCrudMutation } from "../../../lib/useCrudMutation";

type DocumentDateFormValues = { documentDate: string };

/**
 * Das Ausstellungsdatum darf den Stichtag einer bereits festgelegten
 * Vorauszahlungs-Anpassung nicht rückwirkend machen. Die Meldung nennt den
 * Stichtag, damit klar ist, woran es liegt.
 */
const buildSchema = (advanceValidFrom: string | null) =>
  z.object({
    documentDate: z
      .string()
      .min(1, t("ui.statements.documentDate.validation.required"))
      .refine(
        (value) =>
          advanceValidFrom === null ||
          !isAdvanceValidFromRetroactive(advanceValidFrom, value),
        t("ui.statements.documentDate.validation.afterAdvanceValidFrom"),
      ),
  });

/**
 * Ausstellungsdatum eines Entwurfs ändern
 */
export const DocumentDateSheet = ({
  statementId,
  documentDate,
  advanceValidFrom,
  onClose,
}: {
  statementId: string;
  documentDate: string;
  advanceValidFrom: string | null;
  onClose: () => void;
}) => {
  const form = useForm<DocumentDateFormValues>({
    resolver: zodResolver(buildSchema(advanceValidFrom)),
    reValidateMode: "onSubmit",
    defaultValues: { documentDate },
  });

  const save = useCrudMutation({
    mutationFn: (values: DocumentDateFormValues) =>
      api.put(`/statements/${statementId}/document-date`, values),
    invalidateKeys: [["statement"], ["statements"]],
    onSuccess: onClose,
  });

  return (
    <FormSheet
      form={form}
      icon={RiCalendarEventLine}
      title={t("ui.statements.documentDate.title")}
      description={t("ui.statements.documentDate.description")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={async (values) => {
        await save.mutateAsync(values);
      }}
      onClose={onClose}
    >
      <DateInput
        control={form.control}
        name="documentDate"
        label={t("ui.statements.fields.documentDate")}
        description={t("ui.statements.fields.documentDateHint")}
      />
    </FormSheet>
  );
};
