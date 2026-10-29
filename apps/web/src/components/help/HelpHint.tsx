import { type ReactNode, useRef, useState } from "react";
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

/**
 * Beschriftung, an deren linker Kante das Overlay beginnt
 */
const LABEL_SELECTOR = '[data-slot="field-label"], h2, h3';

/**
 * Kleines Fragezeichen an Überschrift oder Beschriftung. Ein Klick öffnet
 * den Hilfetext als Overlay darunter: es verdeckt den Inhalt, statt ihn zu
 * schieben, beginnt bündig mit der Beschriftung und zeigt mit dem Pfeil auf
 * das Fragezeichen. Zweiter Klick, Esc oder ein Klick daneben schließt.
 *
 * Wird ein String mit doppelten Zeilenumbrüchen (`\n\n`) übergeben,
 * werden die Teile als separate Absätze gerendert. Sonst werden die
 * Children unverändert angezeigt.
 */
export const HelpHint = ({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel?: string;
}) => {
  const label = ariaLabel ?? t("ui.common.help");
  const content =
    typeof children === "string" ? renderParagraphs(children) : children;
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [alignOffset, setAlignOffset] = useState(0);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const button = buttonRef.current;
    const labelElement = button?.closest(LABEL_SELECTOR);
    setContainer(
      button?.closest<HTMLElement>(
        '[data-slot="sheet-content"], [data-slot="dialog-content"]',
      ) ?? null,
    );
    if (button && labelElement) {
      setAlignOffset(
        labelElement.getBoundingClientRect().left -
          button.getBoundingClientRect().left,
      );
    }
    setOpen((value) => !value);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Ist die Infobox offen, wäre der Tooltip "Hilfe anzeigen" doppelt */}
      <Tooltip open={tooltipOpen && !open} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild={true}>
          <PopoverTrigger asChild={true}>
            <Button
              ref={buttonRef}
              type="button"
              variant="helpHint"
              size="icon-hint"
              aria-label={label}
              onClick={(event) => {
                // Steht das Fragezeichen in der Beschriftung eines Switches
                // oder Kästchens, würde der Klick sonst auch diesen umlegen
                event.preventDefault();
                toggle();
              }}
            >
              <IconHelp />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        variant="help"
        container={container}
        side="bottom"
        align="start"
        alignOffset={alignOffset}
        // Radix rechnet die Pfeilhöhe (10 px) schon als Abstand ein
        sideOffset={0}
        collisionPadding={16}
        // Fokus bleibt auf dem Fragezeichen, der Hilfetext ist nur zum Lesen
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
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
