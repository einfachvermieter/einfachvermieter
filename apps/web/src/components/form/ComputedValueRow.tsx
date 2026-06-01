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
  <div className="mt-0.5 flex items-center justify-between rounded-[13px] bg-teal-50 px-4.25 py-3.25 dark:bg-teal-950/30">
    <span className="flex items-center gap-2 text-sm font-semibold text-teal-600 dark:text-teal-400">
      {Icon ? <Icon aria-hidden={true} className="size-4.5" /> : null}
      {label}
    </span>
    <span className="text-[19px] font-semibold text-teal-600 tabular-nums dark:text-teal-400">
      {value}
    </span>
  </div>
);
