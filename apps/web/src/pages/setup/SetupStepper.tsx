import { RiCheckLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

type SetupStepperProps = {
  labels: string[];
  current: number;
  srLabel: string;
};

/**
 * Fortschrittsleiste des Einrichtungs-Assistenten: nummerierte Kreise mit
 * Verbindungslinie, erledigte Schritte mit Haken. Schrittnamen erst ab
 * Tablet-Breite, mobil nur die Kreise.
 */
export const SetupStepper = ({
  labels,
  current,
  srLabel,
}: SetupStepperProps) => (
  <ol className="flex items-center gap-2 my-4" aria-label={srLabel}>
    {labels.map((label, index) => {
      const done = index < current;
      const active = index === current;

      return (
        <li
          key={label}
          className="flex flex-1 items-center gap-2 last:flex-none"
          aria-current={active ? "step" : undefined}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              done || active
                ? "bg-azur-500 text-white"
                : "bg-schiefer-100 text-muted-foreground",
              active && "ring-4 ring-azur-200",
            )}
          >
            {done ? <RiCheckLine className="size-3.5" /> : index + 1}
          </span>
          <span
            className={cn(
              "hidden whitespace-nowrap text-sm sm:inline",
              active
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {label}
          </span>
          {index < labels.length - 1 ? (
            <span
              className={cn(
                "h-px min-w-4 flex-1",
                done ? "bg-azur-500" : "bg-border",
              )}
            />
          ) : null}
        </li>
      );
    })}
  </ol>
);
