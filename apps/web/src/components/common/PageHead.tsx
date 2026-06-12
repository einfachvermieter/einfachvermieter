import type { ReactNode } from "react";

/**
 * Seitenkopf für Listenseiten: Gruppenlabel + H1 + Sub-Zeile mit
 * Kontext-Kennzahlen, rechts unten der Primärbutton.
 */
export const PageHead = ({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="mb-5.5 flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
    <div className="min-w-0">
      {eyebrow ? (
        <div className="text-xs font-semibold tracking-wider text-teal-600 uppercase">
          {eyebrow}
        </div>
      ) : null}
      <h1 className="mt-1.5 text-[30px] font-semibold">{title}</h1>
      {sub ? (
        <div className="mt-1.75 text-[14.5px] text-muted-foreground">{sub}</div>
      ) : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);
