import { tenantFormSchema } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiStickyNoteLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormSheet } from "@/components/form/FormSheet";
import { TextareaInput } from "@/components/form/TextareaInput";
import { t } from "../../../lib/i18n";

const notesSchema = tenantFormSchema.pick({ notes: true });

export type TenantNotesValues = z.infer<typeof notesSchema>;

/**
 * Interne Notizen im FormSheet bearbeiten; nur für den Vermieter sichtbar
 */
export const TenantNotesSheet = ({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues: TenantNotesValues;
  onSubmit: (values: TenantNotesValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<TenantNotesValues>({
    resolver: zodResolver(notesSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiStickyNoteLine}
      title={t("ui.tenant.sections.notes.title")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <TextareaInput
        control={form.control}
        name="notes"
        label={t("ui.tenant.fields.notes")}
      />
    </FormSheet>
  );
};
