import { RiCheckLine, RiEditLine } from "@remixicon/react";
import { Spinner } from "@/components/common/Spinner";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

/**
 * Fixe Speicherleiste am unteren Rand der Formularseiten: links der
 * Speicherzeitpunkt (nur beim Bearbeiten), rechts Abbrechen + Speichern.
 * Die Seite braucht dafür unten Platz (`pb-24`), damit die Leiste keinen
 * Inhalt verdeckt.
 */
export const Savebar = ({
  savedAt,
  dirty = false,
  submitting,
  onCancel,
  submitLabel = t("ui.common.action.save"),
}: {
  savedAt?: string;
  dirty?: boolean;
  submitting: boolean;
  onCancel: () => void;
  submitLabel?: string;
}) => (
  <div className="fixed right-0 bottom-0 left-(--sidebar-width,0px) z-10 border-t border-border bg-background/70 py-3.5 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] backdrop-blur-lg max-md:left-0 sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]">
    {/* Linksbündig auf Formularbreite (max-w-225, gleiches Padding wie
        die AppShell), damit Status und Buttons mit dem Formular fluchten */}
    <div className="flex w-full max-w-225 items-center gap-3.5">
      {dirty ? (
        <span className="flex items-center gap-1.75 text-sm text-muted-foreground">
          <RiEditLine aria-hidden={true} className="size-3.75 text-honig-500" />
          {t("ui.common.savebar.unsavedChanges")}
        </span>
      ) : null}
      {savedAt && !dirty ? (
        <span className="flex items-center gap-1.75 text-sm text-muted-foreground">
          <RiCheckLine
            aria-hidden={true}
            className="size-3.75 text-limette-500"
          />
          {t("ui.common.savebar.lastSaved", { date: savedAt })}
        </span>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="secondary"
          type="button"
          onClick={onCancel}
          disabled={submitting}
        >
          {t("ui.common.action.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Spinner data-icon="inline-start" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  </div>
);
