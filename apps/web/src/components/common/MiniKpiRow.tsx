import type { ReactNode } from "react";

/**
 * Reihe kleiner Kennzahl-Kacheln (z. B. Kaution: Vereinbart / Eingegangen /
 * Status). Der Wert darf Text, eine Zahl oder eine Pill sein.
 */
export const MiniKpiRow = ({
  items,
}: {
  items: { label: ReactNode; value: ReactNode }[];
}) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {items.map((item, index) => (
      <div
        // biome-ignore lint/suspicious/noArrayIndexKey: statische Liste
        key={index}
        className="rounded-[13px] border border-border bg-card px-4 py-3.5"
      >
        <div className="text-[11.5px] font-semibold text-slate-400">
          {item.label}
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">
          {item.value}
        </div>
      </div>
    ))}
  </div>
);
