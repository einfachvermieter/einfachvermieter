import { RiQuestionLine } from "@remixicon/react";
import type { ReactNode } from "react";
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
import { t } from "../../lib/i18n";

/**
 * Kleines Fragezeichen-Icon mit zwei Stufen:
 * - Hover: Tooltip "Hilfe anzeigen"
 * - Klick/Touch: Popover mit dem eigentlichen Hilfetext
 *
 * Wird ein String mit doppelten Zeilenumbrüchen (`\n\n`) übergeben,
 * werden die Teile als separate Absätze gerendert. Sonst werden die
 * Children unverändert angezeigt.
 *
 * Beispiel:
 *   <CardTitle>
 *     Mietsätze <HelpHint>{t("ui.tenant.rentsHelp")}</HelpHint>
 *   </CardTitle>
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

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <PopoverTrigger asChild={true}>
            <Button
              type="button"
              variant="helpHint"
              size="icon-hint"
              aria-label={label}
            >
              <RiQuestionLine />
            </Button>
          </PopoverTrigger>
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
