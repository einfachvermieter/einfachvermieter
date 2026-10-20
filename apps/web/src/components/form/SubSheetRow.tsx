import { RiArrowRightSLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Zeile im Formular, die ein SubSheet öffnet: Beschriftung, darunter der
 * Wert als nur lesbare Fläche und rechts der Button zum SubSheet
 */
export const SubSheetRow = ({
  label,
  value,
  actionLabel,
  onOpen,
}: {
  label: string;
  value: ReactNode;
  actionLabel: string;
  onOpen: () => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-sm">{label}</span>
    <div className="flex items-center justify-between gap-3 rounded-lg bg-azur-50 py-1.5 pr-1.5 pl-3 text-azur-900">
      <span className="min-w-0 text-sm font-semibold">{value}</span>
      <Button type="button" variant="outline" size="sm" onClick={onOpen}>
        {actionLabel}
        <RiArrowRightSLine data-icon="inline-end" />
      </Button>
    </div>
  </div>
);
