import { type ReactNode, useId, useState } from "react";
import { IconChevronDown } from "@/lib/icons";

/**
 * Aufklapp-Bereich für selten gebrauchte Felder oder Detailtabellen
 */
export const Disclose = ({
  label,
  defaultOpen = false,
  children,
}: {
  label: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 text-left font-heading text-sm font-semibold text-foreground"
      >
        {label}
        <span aria-hidden={true} className="h-0.5 flex-1 bg-border" />
        <IconChevronDown
          aria-hidden={true}
          className={`size-4.5 text-azur-700 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div id={contentId} className="mt-6">
          {children}
        </div>
      ) : null}
    </div>
  );
};
