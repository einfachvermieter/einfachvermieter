import type { TenantFormValues } from "@einfachvermieter/shared";
import { RiStickyNoteLine } from "@remixicon/react";
import type { UseFormReturn } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { TextareaInput } from "@/components/form/TextareaInput";
import { t } from "../../../../lib/i18n";

/**
 * Abschnitt "Interne Notizen"; nur für den Vermieter sichtbar
 */
export const NotesSection = ({
  form,
}: {
  form: UseFormReturn<TenantFormValues>;
}) => (
  <SectionCard
    icon={RiStickyNoteLine}
    title={t("ui.tenant.sections.notes.title")}
    description={t("ui.tenant.sections.notes.description")}
  >
    <TextareaInput
      control={form.control}
      name="notes"
      label={t("ui.tenant.fields.notes")}
      rows={3}
      textareaClassName="field-sizing-fixed min-h-0 resize-y"
    />
  </SectionCard>
);
