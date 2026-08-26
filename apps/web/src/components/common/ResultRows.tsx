import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ResultRow = {
  label: ReactNode;
  value: ReactNode;
  /**
   * `sum` hebt eine Zwischen-/Endsumme hervor (fett, kräftigere Schrift)
   */
  kind?: "normal" | "sum";
};

/**
 * Ergebnis-Zeilen mit Trennlinien, für Abrechnungs-Zusammenfassung und Heizkostentopf
 */
export const ResultRows = ({ rows }: { rows: ResultRow[] }) => (
  <div>
    {rows.map((row, index) => (
      <div
        // biome-ignore lint/suspicious/noArrayIndexKey: statische Zeilen
        key={index}
        className={cn(
          "flex items-center justify-between border-t border-border py-3 text-base text-muted-foreground first:border-t-0",
          row.kind === "sum" && "font-semibold text-foreground",
        )}
      >
        <span>{row.label}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {row.value}
        </span>
      </div>
    ))}
  </div>
);
