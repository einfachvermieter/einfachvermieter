import { type ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { IconHelp } from "@/lib/icons";
import { t } from "../../lib/i18n";
import { HelpSlotContext } from "./helpSlotContext";

/**
 * Kleines Fragezeichen an Überschrift oder Beschriftung. Ein Klick klappt den
 * Hilfetext als Kasten (Azur 50) im zugehörigen HelpSlot auf und schiebt den
 * Inhalt darunter nach unten, statt ihn zu verdecken. Ohne HelpScope (z. B.
 * in Tabellenköpfen) erscheint der Text als Popover.
 *
 * Wird ein String mit doppelten Zeilenumbrüchen (`\n\n`) übergeben,
 * werden die Teile als separate Absätze gerendert. Sonst werden die
 * Children unverändert angezeigt.
 */
export const HelpHint = ({
  children,
  ariaLabel,
  side = "top",
  align = "center",
}: {
  children: ReactNode;
  ariaLabel?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) => {
  const label = ariaLabel ?? t("ui.common.help");
  const content =
    typeof children === "string" ? renderParagraphs(children) : children;
  const scope = useContext(HelpSlotContext);
  const [open, setOpen] = useState(false);

  const button = (
    <Button
      type="button"
      variant="helpHint"
      size="icon-hint"
      aria-label={label}
      aria-expanded={scope ? open : undefined}
      onClick={scope ? () => setOpen((value) => !value) : undefined}
    >
      <IconHelp />
    </Button>
  );

  if (scope) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild={true}>{button}</TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
        {open && scope.slot
          ? createPortal(
              <div className="space-y-2 rounded-lg bg-azur-50 px-3.5 py-3 text-sm leading-relaxed font-normal text-azur-900">
                {content}
              </div>,
              scope.slot,
            )
          : null}
      </>
    );
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <PopoverTrigger asChild={true}>{button}</PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent side={side} align={align} className="text-sm">
        {content}
      </PopoverContent>
    </Popover>
  );
};

const renderParagraphs = (text: string): ReactNode => {
  const paragraphs = text.split(/\n{2,}/u).filter((p) => p.trim().length > 0);

  if (paragraphs.length <= 1) {
    return text;
  }

  return paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>);
};
