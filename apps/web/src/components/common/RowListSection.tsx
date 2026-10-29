import type { RemixiconComponentType } from "@remixicon/react";
import { Fragment, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { EmptyNote } from "@/components/common/EmptyNote";
import { SectionAction } from "@/components/common/SectionAction";
import { SectionCard } from "@/components/common/SectionCard";
import { DestructiveConfirmDialog } from "@/components/DestructiveConfirmDialog";
import { RowActions } from "@/components/RowActions";
import { t } from "../../lib/i18n";

/**
 * Abschnitt mit einer 1:n-Liste (Bewohner, Mietsätze, Brennwerte): je
 * Eintrag eine Zeile mit blassem Bearbeiten und Löschen am Ende
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
  deleteBlockedReason,
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

  /**
   * Warum sich ein Eintrag nicht löschen lässt, sonst null. Der Dialog
   * erklärt es dann, statt nachzufragen und erst beim Speichern zu scheitern
   */
  deleteBlockedReason?: (index: number) => string | null;
}) => {
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // Beim Öffnen festhalten: Beim Schließen wird der Index leer, der Dialog
  // soll während der Ausblendung aber nicht den Titel wechseln
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

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
      action={<SectionAction kind="add" label={addLabel} onClick={onAdd} />}
    >
      {rows.length === 0 ? <EmptyNote>{emptyHint}</EmptyNote> : null}

      {displayIndices.map((index) => {
        const row = rows[index];
        if (row === undefined) {
          return null;
        }
        return (
          <Fragment key={index}>
            <div className="group/row flex items-center gap-4 border-t border-border py-2.5 first:border-t-0">
              <div className="min-w-0 flex-1">{renderRow(row, index)}</div>
              <RowActions
                onEdit={() => onEditRow(index)}
                onDelete={() => {
                  setBlockedReason(deleteBlockedReason?.(index) ?? null);
                  setDeleteIndex(index);
                }}
              />
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
        title={
          blockedReason ? t("ui.common.removeBlockedTitle") : confirmDeleteTitle
        }
        blocked={blockedReason ?? undefined}
        confirmLabel={t("ui.common.action.confirmRemove")}
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
