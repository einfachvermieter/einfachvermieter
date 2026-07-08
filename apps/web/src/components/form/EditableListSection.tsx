import {
  type RemixiconComponentType,
  RiAddLine,
  RiDeleteBin5Line,
  RiPencilLine,
} from "@remixicon/react";
import { Fragment, type ReactNode, useState } from "react";
import { EmptyNote } from "@/components/common/EmptyNote";
import { IconTile } from "@/components/common/IconTile";
import { SectionCard } from "@/components/common/SectionCard";
import { DestructiveConfirmDialog } from "@/components/DestructiveConfirmDialog";
import { InlineSubform } from "@/components/form/InlineSubform";
import { SubformSubmitProvider } from "@/components/form/subformSubmit";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { t } from "../../lib/i18n";

export type EditableListSectionRowFormProps<T> = {
  defaultValues: T;
  editIndex: number | null;
  onSubmit: (values: T) => void;
  onCancel: () => void;
};

export type EditableListSectionProps<T> = {
  title: string;
  titleHelp?: ReactNode;
  description?: string;
  emptyHint?: string;
  addLabel: string;
  icon: RemixiconComponentType;

  /**
   * Farbe oder Verlauf
   */
  iconBackground: string;

  /**
   * Avatar/Icon-Kachel einer Zeile. Ohne Angabe
   * in Zeilengröße (36px).
   */
  rowLeading?: (row: T, index: number) => ReactNode;

  /**
   * Stabile Schlüssel für jede Zeile. Kommt typischerweise aus
   * `useFieldArray.fields` und wird nur für React's `key` und für die
   * Anzahl der gerenderten Einträge verwendet.
   */
  fieldKeys: { id: string }[];

  /**
   * Aktuell beobachtete Zeilenwerte (z. B. aus `form.watch(name)`).
   */
  rows: T[];

  /**
   * Wie eine Zeile in der Liste dargestellt wird (Titel, Badges, Subline).
   */
  renderRow: (row: T, index: number) => ReactNode;

  onAppend: (values: T) => void;
  onUpdate: (index: number, values: T) => void;
  onRemove: (index: number) => void;

  /**
   * Berechnet die Default-Values fürs Aufklapp-Formular. Bei
   * `editIndex !== null` wird der aktuelle Wert übergeben, bei Add ist
   * `current === undefined`.
   */
  resolveDefaultValues: (editIndex: number | null, current: T | undefined) => T;

  /**
   * Rendert das Zeilen-Formular im sky-getönten Aufklapp-Bereich.
   */
  renderRowForm: (props: EditableListSectionRowFormProps<T>) => ReactNode;

  confirmDeleteTitle: string;

  error?: string;

  /**
   * Liefert die Fehlermeldung für die Zeile am Index oder `undefined`,
   * wenn kein Fehler vorliegt. Bei vorhandenem Fehler bekommt die Zeile
   * einen destruktiven Rahmen und der Text wird darunter angezeigt.
   */
  rowError?: (index: number) => string | undefined;

  /**
   * Optionale Sortierung nur für die Anzeige. Liefert die Original-
   * Indizes (aus `useFieldArray`) in der gewünschten Anzeige-Reihenfolge.
   * Edit-/Delete-Aktionen referenzieren weiterhin den Original-Index.
   */
  sortIndex?: (rows: T[]) => number[];

  /**
   * Aufklapp-Formular für einen neuen Eintrag direkt geöffnet starten
   */
  defaultOpenAdd?: boolean;

  footer?: ReactNode;
};

export const EditableListSection = <T,>({
  title,
  titleHelp,
  description,
  emptyHint,
  addLabel,
  icon,
  iconBackground,
  rowLeading,
  fieldKeys,
  rows,
  renderRow,
  onAppend,
  onUpdate,
  onRemove,
  resolveDefaultValues,
  renderRowForm,
  confirmDeleteTitle,
  error,
  rowError,
  sortIndex,
  defaultOpenAdd = false,
  footer,
}: EditableListSectionProps<T>) => {
  const [editTarget, setEditTarget] = useState<number | "new" | null>(
    defaultOpenAdd ? "new" : null,
  );
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const formOpen = editTarget !== null;
  const editIndex = typeof editTarget === "number" ? editTarget : null;
  const currentRow = editIndex !== null ? rows[editIndex] : undefined;
  const defaultValues = resolveDefaultValues(editIndex, currentRow);

  const closeForm = () => setEditTarget(null);

  const subform = formOpen ? (
    <InlineSubform>
      <SubformSubmitProvider
        value={{
          label: editIndex !== null ? t("ui.common.action.save") : addLabel,
          icon: editIndex !== null ? undefined : <RiAddLine />,
        }}
      >
        {renderRowForm({
          defaultValues,
          editIndex,
          onSubmit: (values) => {
            if (editIndex !== null) {
              onUpdate(editIndex, values);
            } else {
              onAppend(values);
            }
            closeForm();
          },
          onCancel: closeForm,
        })}
      </SubformSubmitProvider>
    </InlineSubform>
  ) : null;

  return (
    <SectionCard
      icon={icon}
      iconBackground={iconBackground}
      title={title}
      titleExtra={titleHelp}
      description={description}
      action={
        <Button
          type="button"
          variant="addLink"
          size="text"
          onClick={() => setEditTarget("new")}
        >
          <RiAddLine />
          {addLabel}
        </Button>
      }
    >
      {editTarget === "new" ? subform : null}

      {fieldKeys.length === 0 && emptyHint && editTarget !== "new" ? (
        <EmptyNote>{emptyHint}</EmptyNote>
      ) : null}

      {(sortIndex
        ? sortIndex(rows).filter((i) => i >= 0 && i < fieldKeys.length)
        : fieldKeys.map((_, i) => i)
      ).map((index) => {
        const key = fieldKeys[index];
        const row = rows[index];
        if (!key || row === undefined) {
          return null;
        }
        const rowErrorMessage = rowError?.(index);
        return (
          <Fragment key={key.id}>
            <div
              data-invalid={rowErrorMessage ? true : undefined}
              className="flex items-center gap-3.25 border-t border-border px-0.5 py-3.25 first:border-t-0 data-invalid:rounded-[12px] data-invalid:border data-invalid:border-destructive data-invalid:bg-destructive/5 data-invalid:px-3"
            >
              {rowLeading?.(row, index) ?? (
                <IconTile icon={icon} size={36} background={iconBackground} />
              )}
              <div className="min-w-0 flex-1">
                {renderRow(row, index)}
                {rowErrorMessage ? (
                  <p className="mt-1 text-sm text-destructive">
                    {rowErrorMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild={true}>
                    <Button
                      type="button"
                      variant="ghostMuted"
                      size="icon-sm"
                      onClick={() => setEditTarget(index)}
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
                      variant="ghostRed"
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
            {editIndex === index ? subform : null}
          </Fragment>
        );
      })}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {footer}

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
          if (deleteIndex !== null) {
            onRemove(deleteIndex);
            setDeleteIndex(null);
          }
        }}
      />
    </SectionCard>
  );
};
