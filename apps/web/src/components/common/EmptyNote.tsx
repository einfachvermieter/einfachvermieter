import type { ReactNode } from "react";

/**
 * Leerer Abschnitt: nur ein Satz, was hineingehört
 */
export const EmptyNote = ({ children }: { children: ReactNode }) => (
  <p className="text-sm leading-normal text-muted-foreground">{children}</p>
);
