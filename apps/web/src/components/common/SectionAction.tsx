import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { IconPen, IconPlus } from "@/lib/icons";

/**
 * Aktion in der Kopfzeile eines Abschnitts: kleiner Button nur mit Icon, immer
 * als Button sichtbar.
 */
export const SectionAction = ({
  kind,
  label,
  onClick,
  disabled = false,
}: {
  kind: "add" | "edit";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <Tooltip>
    <TooltipTrigger asChild={true}>
      <Button
        type="button"
        variant="action"
        size="icon-sm"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {kind === "add" ? <IconPlus /> : <IconPen />}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);
