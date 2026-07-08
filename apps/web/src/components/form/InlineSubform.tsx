import type { ReactNode } from "react";

/**
 * Aufklapp-Formular in Karten ("wird gerade erfasst")
 */
export const InlineSubform = ({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) => (
  <div className="mt-2.5 rounded-[13px] border border-sky-100 bg-sky-50 p-4 **:data-[slot=input-group]:bg-card **:data-[slot=input]:bg-card **:data-[slot=select-trigger]:bg-card **:data-[slot=textarea]:bg-card dark:border-sky-900 dark:bg-sky-950/30">
    {children}
    {actions ? (
      <div className="mt-3.5 flex justify-end gap-2">{actions}</div>
    ) : null}
  </div>
);
