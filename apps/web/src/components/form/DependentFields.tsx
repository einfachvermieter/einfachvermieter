import type { ReactNode } from "react";

/**
 * Felder, die von einem Schalter oder einer Auswahl darüber abhängen:
 * eingerückt hinter einer senkrechten Linie
 */
export const DependentFields = ({ children }: { children: ReactNode }) => (
  <div className="ml-4.5 grid gap-6 border-l-2 border-border pl-7.5">
    {children}
  </div>
);
