import type { ReactNode } from "react";

/**
 * Listenzeile in Karten (Bewohner, Mietsätze, Bankverbindungen): nur
 * Trennlinien, keine Boxen.
 */
export const CardListRow = ({
  leading,
  title,
  subline,
  actions,
}: {
  leading: ReactNode;
  title: ReactNode;
  subline?: ReactNode;
  actions?: ReactNode;
}) => (
  <div className="flex items-center gap-3.25 border-t border-border px-0.5 py-3.25 first:border-t-0">
    {leading}
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {title}
      </div>
      {subline ? (
        <div className="mt-0.75 text-[12.5px] text-slate-400">{subline}</div>
      ) : null}
    </div>
    {actions ? <div className="flex gap-0.5">{actions}</div> : null}
  </div>
);
