import type { ReactNode } from "react";

/**
 * Abschnitt der rechten Infospalte: Versalien-Titel mit Trennlinie,
 * darunter Key-Value-Zeilen und/oder freier Inhalt. Ohne Kartenrahmen.
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
  <section>
    <div className="mb-2.5 flex items-center gap-3">
      <h3 className="text-2xs font-semibold tracking-[0.07em] text-muted-foreground uppercase">
        {title}
      </h3>
      <span aria-hidden={true} className="h-px flex-1 bg-border" />
    </div>
    {rows?.map((row) => (
      <div
        key={row.label}
        className="flex items-center justify-between gap-3 border-b border-schiefer-100 px-2 py-2.5 text-sm last:border-b-0"
      >
        <span className="text-muted-foreground">{row.label}</span>
        <span className="min-w-0 text-right font-medium">{row.value}</span>
      </div>
    ))}
    {children}
  </section>
);
