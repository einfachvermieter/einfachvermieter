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
  <div
    data-slot="inline-subform"
    className="my-2.5 rounded-lg border border-border bg-schiefer-50 p-4"
  >
    {children}
    {actions ? (
      <div className="mt-3.5 flex justify-end gap-2">{actions}</div>
    ) : null}
  </div>
);
