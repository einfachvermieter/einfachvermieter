import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MonthTile = {
  label: string;
  value: ReactNode;
  /**
   * ok = eingegangen (Limette), open = offen (Honig), outside = außerhalb der Mietzeit (neutral) */
  state: "ok" | "open" | "outside";
};

const STATE_CLASSES: Record<MonthTile["state"], string> = {
  ok: "border-limette-200 bg-limette-50 **:data-[slot=month-value]:text-limette-700",
  open: "border-honig-200 bg-honig-50 **:data-[slot=month-value]:text-honig-800",
  outside: "border-border bg-card **:data-[slot=month-value]:text-schiefer-400",
};

/**
 * Monatsraster als Kacheln (Zahlungs-Matrix)
 */
export const MonthTileGrid = ({ months }: { months: MonthTile[] }) => (
  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
    {months.map((month) => (
      <div
        key={month.label}
        className={cn(
          "rounded-md border px-2.5 py-2",
          STATE_CLASSES[month.state],
        )}
      >
        <div className="text-2xs font-semibold text-muted-foreground">
          {month.label}
        </div>
        <div
          data-slot="month-value"
          className="mt-0.5 text-sm font-semibold tabular-nums"
        >
          {month.value}
        </div>
      </div>
    ))}
  </div>
);
