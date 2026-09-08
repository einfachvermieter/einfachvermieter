import { RiCheckLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

type SetupStepperProps = {
  labels: string[];
  current: number;
  srLabel: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
};

type StepState = "done" | "active" | "todo";

const stepState = (index: number, current: number): StepState => {
  if (index < current) {
    return "done";
  }
  return index === current ? "active" : "todo";
};

const circleClasses: Record<StepState, string> = {
  done: "bg-azur-500 text-white",
  active: "bg-azur-500 text-white ring-4 ring-azur-200",
  todo: "bg-schiefer-100 text-muted-foreground",
};

const labelClasses: Record<StepState, string> = {
  done: "text-muted-foreground",
  active: "font-semibold text-foreground",
  todo: "text-muted-foreground",
};

/**
 * Fortschrittsanzeige des Einrichtungs-Assistenten: nummerierte Kreise,
 * erledigte Schritte mit Haken, verbunden durch eine Linie.
 */
export const SetupStepper = ({
  labels,
  current,
  srLabel,
  orientation = "horizontal",
  className,
}: SetupStepperProps) => {
  const vertical = orientation === "vertical";
  const connectorShape = vertical
    ? "my-1 ml-3 h-5 w-px"
    : "h-px min-w-4 flex-1";

  return (
    <ol
      className={cn(
        "flex",
        vertical ? "flex-col" : "items-center gap-2",
        className,
      )}
      aria-label={srLabel}
    >
      {labels.map((label, index) => {
        const state = stepState(index, current);
        const last = index === labels.length - 1;

        return (
          <li
            key={label}
            className={cn(
              "flex",
              vertical
                ? "flex-col"
                : "flex-1 items-center gap-2 last:flex-none",
            )}
            aria-current={state === "active" ? "step" : undefined}
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  circleClasses[state],
                )}
              >
                {state === "done" ? (
                  <RiCheckLine className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-sm",
                  vertical ? "inline" : "hidden sm:inline",
                  labelClasses[state],
                )}
              >
                {label}
              </span>
            </span>
            {last ? null : (
              <span
                className={cn(
                  connectorShape,
                  state === "done" ? "bg-azur-500" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};
