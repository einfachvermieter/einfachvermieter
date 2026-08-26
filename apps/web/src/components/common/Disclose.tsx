import { RiArrowDownSLine } from "@remixicon/react";
import { type ReactNode, useId, useState } from "react";

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
        className="inline-flex items-center gap-1.25 text-sm font-semibold text-limette-700"
      >
        <RiArrowDownSLine
          className={`size-3.75 transition-transform ${open ? "rotate-180" : ""}`}
        />
        {label}
      </button>
      {open ? (
        <div id={contentId} className="mt-3.5">
          {children}
        </div>
      ) : null}
    </div>
  );
};
