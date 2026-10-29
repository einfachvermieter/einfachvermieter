import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent } from "@/components/ui/Collapsible";

/**
 * Felder, die ein Switch oder eine Auswahl darüber ein- und ausblendet. Sie
 * fahren auf und zu, damit man sieht, was sich geändert hat. Steht in einer
 * Spalte mit 24 px Abstand (Sheet-Gruppe, FieldGroup): Der Abstand fährt
 * mit, statt beim Öffnen auf einmal dazuzukommen
 */
export const Reveal = ({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) => (
  // Hebt den Abstand der Spalte auf, solange nichts zu sehen ist; geöffnet
  // bringt der Inhalt ihn oben selbst mit
  <div className="-mt-6">
    <Collapsible open={open}>
      <CollapsibleContent>
        <div className="flex flex-col gap-6 pt-6">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  </div>
);
