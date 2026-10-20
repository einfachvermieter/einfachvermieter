import { createContext } from "react";

/**
 * Platz, an dem ein HelpHint seinen Text aufklappt: unter der Beschriftung
 * bzw. der Kopfzeile, sodass der Text den Inhalt nach unten schiebt statt
 * ihn zu verdecken
 */
export type HelpSlotValue = {
  slot: HTMLElement | null;
  setSlot: (element: HTMLElement | null) => void;
};

export const HelpSlotContext = createContext<HelpSlotValue | null>(null);
