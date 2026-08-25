import type { ReactNode } from "react";

/**
 * Erste Tabellenspalte: Icon-Kachel oder Avatar + Name (fett) + optionale
 * Subline
 */
export const EntityCell = ({
  tile,
  name,
  subline,
}: {
  tile?: ReactNode;
  name: ReactNode;
  subline?: ReactNode;
}) => (
  <div className="flex items-center gap-3">
    {tile}
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-foreground">
        {name}
      </div>
      {subline ? (
        <div className="mt-0.5 truncate text-xs text-slate-400">{subline}</div>
      ) : null}
    </div>
  </div>
);
