import type { RemixiconComponentType } from "@remixicon/react";
import { type ReactNode, useId, useState } from "react";
import { IconChevronDown } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Abschnitt einer Detailseite, ohne Card: Überschrift, rechts davon eine
 * kräftige Linie bis zu den Buttons, darunter der Inhalt. Die dünnen Linien
 * gehören den Zeilen. Die Kopfzeile ist mit und ohne Button gleich hoch
 */
export const SectionCard = ({
  title,
  titleExtra,
  description,
  action,
  collapsible = false,
  defaultOpen = false,
  children,
}: {
  /**
   * Wird nicht mehr angezeigt; Abschnitte tragen kein Icon
   */
  icon?: RemixiconComponentType;
  title: string;
  /** Zusatz neben dem Titel, z. B. ein HelpHint */
  titleExtra?: ReactNode;
  description?: string;
  action?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const sectionId = useId();
  const showBody = !collapsible || open;

  return (
    <section
      id={sectionId}
      data-toc-title={title}
      className="max-w-205 scroll-mt-32 pt-4.5 pb-5.5"
    >
      <div className="relative flex min-h-7.5 flex-wrap items-center gap-x-3">
        <h2 className="flex items-center gap-1 font-heading text-lg leading-none font-semibold">
          {collapsible ? (
            // Klickfläche per Pseudo-Element über die ganze Kopfzeile
            // strecken; HelpHint und Aktion liegen als positionierte
            // Nachbarn darüber und bleiben eigenständig klickbar
            <button
              type="button"
              aria-expanded={open}
              aria-controls={contentId}
              onClick={() => setOpen((value) => !value)}
              className="text-left after:absolute after:inset-0"
            >
              {title}
            </button>
          ) : (
            title
          )}
          {titleExtra ? (
            <span className="relative shrink-0">{titleExtra}</span>
          ) : null}
        </h2>
        <span aria-hidden={true} className="h-0.5 min-w-6 flex-1 bg-border" />
        {showBody && action ? (
          <span className="relative flex shrink-0 gap-1.5">{action}</span>
        ) : null}
        {collapsible ? (
          <IconChevronDown
            aria-hidden={true}
            className={cn(
              "pointer-events-none size-4.5 shrink-0 text-azur-700 transition-transform",
              open && "rotate-180",
            )}
          />
        ) : null}
      </div>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {showBody ? (
        <div id={contentId} className="mt-1.5">
          {children}
        </div>
      ) : null}
    </section>
  );
};
