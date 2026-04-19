import { RiDeleteBin6Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { Spinner } from "./common/Spinner";
import { Button } from "./ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/Tooltip";

type RowActionButtonProps = {
  label: string;
  variant?: "ghostMuted" | "ghostRed";
  icon?: ReactNode;
  onSelect?: () => void;
  children?: ReactNode;
};

export const RowActionButton = ({
  label,
  variant = "ghostMuted",
  icon,
  onSelect,
  children,
}: RowActionButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild={true}>
      {children ? (
        <Button
          asChild={true}
          variant={variant}
          size="icon-sm"
          aria-label={label}
        >
          {children}
        </Button>
      ) : (
        <Button
          variant={variant}
          size="icon-sm"
          aria-label={label}
          onClick={onSelect}
        >
          {icon}
        </Button>
      )}
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

type RowActionsProps = {
  isDeleting?: boolean;
  editLink?: ReactNode;
  editLabel?: string;
  extraActions?: ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
};

export const RowActions = ({
  isDeleting,
  editLink,
  editLabel = t("ui.common.action.edit"),
  extraActions,
  onDelete,
  deleteLabel = t("ui.common.action.delete"),
}: RowActionsProps) => {
  const deleteAction = isDeleting ? (
    <span className="flex size-8 items-center justify-center">
      <Spinner className="text-muted-foreground" />
    </span>
  ) : (
    <RowActionButton
      label={deleteLabel}
      variant="ghostRed"
      icon={<RiDeleteBin6Line />}
      onSelect={onDelete}
    />
  );

  return (
    <div className="flex items-center justify-start gap-0.5">
      {editLink ? (
        <RowActionButton label={editLabel}>{editLink}</RowActionButton>
      ) : null}
      {extraActions}
      {onDelete ? deleteAction : null}
    </div>
  );
};
