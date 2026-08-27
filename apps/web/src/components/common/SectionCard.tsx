import {
  type RemixiconComponentType,
  RiArrowDownSLine,
} from "@remixicon/react";
import { type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Abschnitt-Card mit Kopfzeile: kleines Akzent-Icon, Titel, optionale
 * Beschreibung und Aktion rechts
 */
export const SectionCard = ({
  icon: Icon,
  title,
  titleExtra,
  description,
  action,
  collapsible = false,
  defaultOpen = false,
  children,
}: {
  icon: RemixiconComponentType;
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
  const showBody = !collapsible || open;

  return (
    <section className="mb-4 rounded-xl border border-border bg-card px-5.5 py-4.5">
      <div
        className={cn("relative flex items-center gap-2.5", showBody && "mb-4")}
      >
        <Icon aria-hidden={true} className="size-5 shrink-0 text-azur-700" />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1 text-lg font-semibold">
            {collapsible ? (
              // Klickfläche per Pseudo-Element über die ganze Kopfzeile
              // strecken; HelpHint und Aktion liegen als positionierte
              // Nachbarn darüber und bleiben eigenständig klickbar
              <button
                type="button"
                aria-expanded={open}
                aria-controls={contentId}
                onClick={() => setOpen((value) => !value)}
                className="cursor-pointer text-left after:absolute after:inset-0"
              >
                {title}
              </button>
            ) : (
              title
            )}
            {titleExtra ? (
              <span className="relative shrink-0 translate-y-px">
                {titleExtra}
              </span>
            ) : null}
          </h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {showBody && action ? (
          <span className="relative shrink-0">{action}</span>
        ) : null}
        {collapsible ? (
          <RiArrowDownSLine
            aria-hidden={true}
            className={cn(
              "pointer-events-none size-4.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        ) : null}
      </div>
      {showBody ? <div id={contentId}>{children}</div> : null}
    </section>
  );
};
