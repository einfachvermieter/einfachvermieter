import type { ReactNode } from "react";

/**
 * Leerer Zustand in Karten
 */
export const EmptyNote = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg bg-muted px-3.5 py-3 text-sm leading-normal text-muted-foreground">
    {children}
  </p>
);
