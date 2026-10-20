import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Gruppe innerhalb eines FormSheet: kleiner Titel mit Linie, darunter die
 * Felder. Gruppen werden durch eine Linie getrennt
 */
export const SheetSection = ({
  title,
  description,
  divider = true,
  children,
}: {
  /**
   * Wird nicht mehr angezeigt; Gruppen tragen kein Icon
   */
  icon?: RemixiconComponentType;
  title: string;
  description?: string;
  divider?: boolean;
  children: ReactNode;
}) => (
  <section
    className={cn(
      "flex flex-col gap-6",
      divider && "border-t border-border pt-6",
    )}
  >
    <div>
      <div className="flex items-center gap-2.5">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <span aria-hidden={true} className="h-0.5 flex-1 bg-border" />
      </div>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {children}
  </section>
);
