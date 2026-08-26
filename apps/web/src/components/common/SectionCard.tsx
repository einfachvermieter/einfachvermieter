import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";

/**
 * Sektions-Karte mit Kopfzeile: kleines Akzent-Icon, Titel, optionale
 * Beschreibung und Aktion rechts
 */
export const SectionCard = ({
  icon: Icon,
  title,
  titleExtra,
  description,
  action,
  children,
}: {
  icon: RemixiconComponentType;
  title: string;
  /** Zusatz neben dem Titel, z. B. ein HelpHint */
  titleExtra?: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="mb-4 rounded-xl border border-border bg-card px-5.5 py-4.5">
    <div className="mb-4 flex items-center gap-2.5">
      <Icon aria-hidden={true} className="size-5 shrink-0 text-limette-700" />
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-1 text-lg font-semibold">
          {title}
          {titleExtra}
        </h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
    <div>{children}</div>
  </section>
);
