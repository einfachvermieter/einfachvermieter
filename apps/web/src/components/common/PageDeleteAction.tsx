import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { IconTrash } from "@/lib/icons";
import { t } from "../../lib/i18n";

/**
 * Löschen im Seitenkopf einer Detailseite: blasser Button nur mit Icon, wird
 * erst beim Überfahren rot
 */
export const PageDeleteAction = ({ onClick }: { onClick: () => void }) => {
  const label = t("ui.common.action.delete");
  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        <Button
          type="button"
          variant="outlineDestructive"
          size="icon"
          aria-label={label}
          onClick={onClick}
        >
          <IconTrash />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
