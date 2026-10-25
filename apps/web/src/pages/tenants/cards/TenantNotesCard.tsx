import { RiStickyNoteLine } from "@remixicon/react";
import { EmptyNote } from "@/components/common/EmptyNote";
import { SectionAction } from "@/components/common/SectionAction";
import { SectionCard } from "@/components/common/SectionCard";
import { HelpHint } from "@/components/help/HelpHint";
import { t } from "../../../lib/i18n";

/**
 * View-Card der internen Notizen; Bearbeiten öffnet das Notiz-Sheet
 */
export const TenantNotesCard = ({
  notes,
  onEdit,
}: {
  notes: string;
  onEdit: () => void;
}) => (
  <SectionCard
    icon={RiStickyNoteLine}
    title={t("ui.tenant.sections.notes.title")}
    titleExtra={
      <HelpHint>{t("ui.tenant.sections.notes.description")}</HelpHint>
    }
    collapsible={true}
    defaultOpen={Boolean(notes)}
    action={
      <SectionAction
        kind="edit"
        label={t("ui.common.action.edit")}
        onClick={onEdit}
      />
    }
  >
    {notes ? (
      <p className="text-sm whitespace-pre-wrap">{notes}</p>
    ) : (
      <EmptyNote>{t("ui.tenant.notesEmptyHint")}</EmptyNote>
    )}
  </SectionCard>
);
