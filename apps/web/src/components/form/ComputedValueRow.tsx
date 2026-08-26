import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";

/**
 * Fläche für live berechnete Werte in Formularen
 */
export const ComputedValueRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon?: RemixiconComponentType;
  label: string;
  value: ReactNode;
}) => (
  <div className="mt-0.5 flex items-center justify-between rounded-lg bg-limette-50 px-4 py-3">
    <span className="flex items-center gap-2 text-sm font-semibold text-limette-700">
      {Icon ? <Icon aria-hidden={true} className="size-4.5" /> : null}
      {label}
    </span>
    <span className="text-lg font-semibold text-limette-700 tabular-nums">
      {value}
    </span>
  </div>
);
