import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Einfärbung des Werts, wenn eine Zahl auf etwas Offenes hinweist
 */
const VALUE_TONE = {
  neutral: "",
  warning: "text-honig-600",
  bad: "text-himbeere-500",
} as const;

/**
 * Reihe kleiner Kennzahlen ohne Fläche, je Kennzahl eine Linie links (z. B.
 * Kaution: Vereinbart / Eingegangen / Status). Der Wert darf Text, eine Zahl
 * oder eine Pill sein.
 */
export const MiniKpiRow = ({
  items,
  columns = 3,
}: {
  items: {
    label: ReactNode;
    value: ReactNode;
    hint?: ReactNode;
    tone?: keyof typeof VALUE_TONE;
  }[];

  /**
   * Spalten ab sm
   */
  columns?: 1 | 2 | 3;
}) => (
  <div
    className={cn(
      "grid grid-cols-1 gap-5",
      columns === 2 && "sm:grid-cols-2",
      columns === 3 && "sm:grid-cols-3",
    )}
  >
    {items.map((item, index) => (
      <div
        // biome-ignore lint/suspicious/noArrayIndexKey: statische Liste
        key={index}
        className="border-l-2 border-border pl-4"
      >
        <div className="text-xs text-muted-foreground">{item.label}</div>
        <div
          className={cn(
            "mt-0.5 font-heading text-lg font-semibold tabular-nums",
            VALUE_TONE[item.tone ?? "neutral"],
          )}
        >
          {item.value}
        </div>
        {item.hint ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {item.hint}
          </div>
        ) : null}
      </div>
    ))}
  </div>
);
