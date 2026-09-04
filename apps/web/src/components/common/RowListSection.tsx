import {
  type RemixiconComponentType,
  RiAddLine,
  RiDeleteBin5Line,
  RiPencilLine,
} from "@remixicon/react";
import { Fragment, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { EmptyNote } from "@/components/common/EmptyNote";
import { IconTile } from "@/components/common/IconTile";
import { SectionCard } from "@/components/common/SectionCard";
import { DestructiveConfirmDialog } from "@/components/DestructiveConfirmDialog";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { t } from "../../lib/i18n";

/**
 * View-Card einer 1:n-Liste (Bewohner, Mietsätze, Brennwerte)
 */
export const RowListSection = <T,>({
  icon,
  title,
  titleHelp,
  addLabel,
  emptyHint,
  collapsible = false,
  defaultOpen = false,
  rows,
  renderRow,
  sortIndex,
  onAdd,
  onEditRow,
  onDeleteRow,
  confirmDeleteTitle,
}: {
  icon: RemixiconComponentType;
  title: string;
  titleHelp?: ReactNode;
  addLabel: string;
  emptyHint: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  rows: T[];
  renderRow: (row: T, index: number) => ReactNode;
  sortIndex?: (rows: T[]) => number[];
  onAdd: () => void;
  onEditRow: (index: number) => void;
  onDeleteRow: (index: number) => Promise<void>;
  confirmDeleteTitle: string;
}) => {
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const displayIndices = sortIndex
    ? sortIndex(rows).filter((index) => index >= 0 && index < rows.length)
    : rows.map((_, index) => index);

  return (
    <SectionCard
      icon={icon}
      title={title}
      titleExtra={titleHelp}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      action={
        <Button type="button" variant="addLink" size="text" onClick={onAdd}>
          <RiAddLine />
          {addLabel}
        </Button>
      }
    >
      {rows.length === 0 ? <EmptyNote>{emptyHint}</EmptyNote> : null}

      {displayIndices.map((index) => {
        const row = rows[index];
        if (row === undefined) {
          return null;
        }
        return (
          <Fragment key={index}>
            <div className="flex items-center gap-3.25 border-t border-border px-0.5 py-3.25 first:border-t-0">
              <IconTile icon={icon} size={36} />
              <div className="min-w-0 flex-1">{renderRow(row, index)}</div>
              <div className="flex shrink-0 gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild={true}>
                    <Button
                      type="button"
                      variant="ghostMuted"
                      size="icon-sm"
                      onClick={() => onEditRow(index)}
                      aria-label={t("ui.common.action.edit")}
                    >
                      <RiPencilLine />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("ui.common.action.edit")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild={true}>
                    <Button
                      type="button"
                      variant="ghostDestructive"
                      size="icon-sm"
                      onClick={() => setDeleteIndex(index)}
                      aria-label={t("ui.common.action.delete")}
                    >
                      <RiDeleteBin5Line />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("ui.common.action.delete")}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </Fragment>
        );
      })}

      <DestructiveConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteIndex(null);
          }
        }}
        title={confirmDeleteTitle}
        confirmLabel={t("ui.common.action.delete")}
        onConfirm={() => {
          const index = deleteIndex;
          setDeleteIndex(null);
          if (index === null) {
            return;
          }
          onDeleteRow(index).catch((err) => {
            toast.error(
              err instanceof Error ? err.message : t("common.saveFailed"),
            );
          });
        }}
      />
    </SectionCard>
  );
};
