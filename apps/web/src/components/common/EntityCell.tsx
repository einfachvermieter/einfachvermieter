import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Erste Tabellenspalte: Icon-Kachel oder Avatar + Name (fett) + optionale
 * Subline
 */
export const EntityCell = ({
  tile,
  name,
  subline,
  mono = false,
}: {
  tile: ReactNode;
  name: ReactNode;
  subline?: ReactNode;
  mono?: boolean;
}) => (
  <div className="flex items-center gap-3">
    {tile}
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-foreground">
        {name}
      </div>
      {subline ? (
        <div
          className={cn(
            "mt-0.5 truncate text-xs text-slate-400",
            mono && "tabular-nums",
          )}
        >
          {subline}
        </div>
      ) : null}
    </div>
  </div>
);
