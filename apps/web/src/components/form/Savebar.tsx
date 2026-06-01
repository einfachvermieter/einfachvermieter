import { RiCheckLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

/**
 * Fixe Speicherleiste am unteren Rand großer Formularseiten: links der
 * Speicherstatus, rechts Abbrechen + Speichern
 */
export const Savebar = ({
  savedAt,
  children,
}: {
  savedAt?: string;
  children: ReactNode;
}) => (
  <div className="fixed right-0 bottom-0 left-(--sidebar-width,0px) z-10 flex items-center gap-3.5 border-t border-border bg-background/90 px-9 py-3.5 backdrop-blur-lg max-md:left-0">
    {savedAt ? (
      <span className="flex items-center gap-1.75 text-[12.5px] text-slate-400">
        <RiCheckLine aria-hidden={true} className="size-3.75 text-teal-600" />
        {t("ui.common.savebar.lastSaved", { date: savedAt })}
      </span>
    ) : null}
    <div className="ml-auto flex items-center gap-2">{children}</div>
  </div>
);
