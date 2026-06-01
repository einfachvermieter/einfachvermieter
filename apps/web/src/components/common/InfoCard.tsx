import type { ReactNode } from "react";

/**
 * Karte der rechten Infospalte. Caps-Label oben,
 * darunter Key-Value-Zeilen und/oder freier Inhalt.
 */
export const InfoCard = ({
  title,
  rows,
  children,
}: {
  title: string;
  rows?: { label: string; value: ReactNode }[];
  children?: ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card p-5.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="mb-3.5 text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
      {title}
    </div>
    {rows?.map((row) => (
      <div
        key={row.label}
        className="flex items-center justify-between gap-3 border-t border-border py-2.5 text-[13.5px] first:border-t-0"
      >
        <span className="text-muted-foreground">{row.label}</span>
        <span className="min-w-0 text-right font-semibold">{row.value}</span>
      </div>
    ))}
    {children}
  </div>
);
