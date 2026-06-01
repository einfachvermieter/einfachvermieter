import type { ReactNode } from "react";

/**
 * Leerer Zustand in Karten
 */
export const EmptyNote = ({ children }: { children: ReactNode }) => (
  <p className="rounded-[12px] bg-muted px-3.75 py-3.25 text-[12.5px] leading-normal text-muted-foreground">
    {children}
  </p>
);
