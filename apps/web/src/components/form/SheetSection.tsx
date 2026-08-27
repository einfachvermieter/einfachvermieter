import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Abschnitt innerhalb eines FormSheet: Trennlinie, Akzent-Icon und
 * Überschrift wie im Kartenkopf der Detailseiten, darunter die Felder.
 */
export const SheetSection = ({
  icon: Icon,
  title,
  description,
  divider = true,
  children,
}: {
  icon: RemixiconComponentType;
  title: string;
  description?: string;
  divider?: boolean;
  children: ReactNode;
}) => (
  <section
    className={cn(
      "flex flex-col gap-4",
      divider && "border-t border-border pt-5",
    )}
  >
    <div className="flex items-center gap-2.5">
      <Icon aria-hidden={true} className="size-5 shrink-0 text-azur-700" />
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
    {children}
  </section>
);
