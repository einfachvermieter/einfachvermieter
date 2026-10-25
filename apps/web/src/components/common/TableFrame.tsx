import type { ReactNode } from "react";

/**
 * Rahmen mit runden Ecken um eine Tabelle in einem Abschnitt. Die unterste
 * Zeile schließt mit dem Rahmen ab
 */
export const TableFrame = ({ children }: { children: ReactNode }) => (
  <div className="overflow-hidden rounded-lg border border-border">
    {children}
  </div>
);
