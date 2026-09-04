import { RiPencilLine, RiStickyNoteLine } from "@remixicon/react";
import { EmptyNote } from "@/components/common/EmptyNote";
import { SectionCard } from "@/components/common/SectionCard";
import { HelpHint } from "@/components/help/HelpHint";
import { Button } from "@/components/ui/Button";
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
      <Button type="button" variant="addLink" size="text" onClick={onEdit}>
        <RiPencilLine />
        {t("ui.common.action.edit")}
      </Button>
    }
  >
    {notes ? (
      <p className="text-sm whitespace-pre-wrap">{notes}</p>
    ) : (
      <EmptyNote>{t("ui.tenant.notesEmptyHint")}</EmptyNote>
    )}
  </SectionCard>
);
