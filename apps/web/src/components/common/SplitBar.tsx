import type { ReactNode } from "react";

/**
 * Zweigeteilter Anteils-Balken (z. B. Grund-/Verbrauchskosten) mit Legende
 */
export const SplitBar = ({
  aPercent,
  aLabel,
  bLabel,
}: {
  aPercent: number;
  aLabel: ReactNode;
  bLabel: ReactNode;
}) => {
  const a = Math.min(100, Math.max(0, aPercent));
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <span className="bg-sky-600" style={{ width: `${a}%` }} />
        <span className="bg-teal-500" style={{ width: `${100 - a}%` }} />
      </div>
      <div className="mt-1.75 flex justify-between text-xs text-slate-600">
        <span>{aLabel}</span>
        <span>{bLabel}</span>
      </div>
    </div>
  );
};
