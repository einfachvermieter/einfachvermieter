import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { IconPen, IconTrash } from "@/lib/icons";
import { Spinner } from "./common/Spinner";
import { Button } from "./ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/Tooltip";

type RowActionButtonProps = {
  label: string;
  variant?: "row" | "rowDestructive";
  icon?: ReactNode;
  onSelect?: () => void;
  children?: ReactNode;
};

export const RowActionButton = ({
  label,
  variant = "row",
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
  onEdit?: () => void;
  editLabel?: string;
  extraActions?: ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
};

export const RowActions = ({
  isDeleting,
  editLink,
  onEdit,
  editLabel = t("ui.common.action.edit"),
  extraActions,
  onDelete,
  deleteLabel = t("ui.common.action.delete"),
}: RowActionsProps) => {
  const deleteAction = isDeleting ? (
    <span className="flex h-7 w-7.5 items-center justify-center">
      <Spinner className="text-muted-foreground" />
    </span>
  ) : (
    <RowActionButton
      label={deleteLabel}
      variant="rowDestructive"
      icon={<IconTrash />}
      onSelect={onDelete}
    />
  );

  return (
    // Bearbeiten und Löschen stehen als verbundenes Paar
    <div className="flex items-center justify-start *:rounded-none *:not-first:-ml-px *:first:rounded-l-md *:last:rounded-r-md">
      {editLink ? (
        <RowActionButton label={editLabel}>{editLink}</RowActionButton>
      ) : null}
      {onEdit ? (
        <RowActionButton
          label={editLabel}
          icon={<IconPen />}
          onSelect={onEdit}
        />
      ) : null}
      {extraActions}
      {onDelete ? deleteAction : null}
    </div>
  );
};
