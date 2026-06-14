import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MonthTile = {
  label: string;
  value: ReactNode;
  /**
   * ok = eingegangen (teal), open = offen (amber), outside = außerhalb der Mietzeit (neutral) */
  state: "ok" | "open" | "outside";
};

const STATE_CLASSES: Record<MonthTile["state"], string> = {
  ok: "border-teal-100 bg-teal-50 [&_[data-slot=month-value]]:text-teal-600",
  open: "border-amber-200 bg-amber-50 [&_[data-slot=month-value]]:text-amber-700",
  outside: "border-border bg-card [&_[data-slot=month-value]]:text-slate-400",
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
          "rounded-[11px] border px-2.75 py-2.25",
          STATE_CLASSES[month.state],
        )}
      >
        <div className="text-[11.5px] font-semibold text-slate-400">
          {month.label}
        </div>
        <div
          data-slot="month-value"
          className="mt-0.75 text-[13.5px] font-semibold tabular-nums"
        >
          {month.value}
        </div>
      </div>
    ))}
  </div>
);
