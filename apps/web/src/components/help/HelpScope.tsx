import { type ReactNode, useMemo, useState } from "react";
import { HelpSlotContext } from "./helpSlotContext";

/**
 * Bereich, dessen HelpHints ihren Text in den zugehörigen HelpSlot aufklappen
 */
export const HelpScope = ({ children }: { children: ReactNode }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return (
    <HelpSlotContext.Provider value={value}>
      {children}
    </HelpSlotContext.Provider>
  );
};
