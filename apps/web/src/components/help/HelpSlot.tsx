import { useContext } from "react";
import { cn } from "../../lib/utils";
import { HelpSlotContext } from "./helpSlotContext";

/**
 * Stelle im Layout, an der der Hilfetext eines HelpHint aufklappt.
 */
export const HelpSlot = ({ className }: { className?: string }) => {
  const context = useContext(HelpSlotContext);
  return (
    <div ref={context?.setSlot} className={cn("empty:hidden", className)} />
  );
};
