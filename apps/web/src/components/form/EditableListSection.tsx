import { RiAddLine, RiDeleteBin5Line, RiPencilLine } from "@remixicon/react";
import { type ReactNode, useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { DestructiveConfirmDialog } from "@/components/DestructiveConfirmDialog";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
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
   * Berechnet die Default-Values für den Dialog. Bei `editIndex !== null`
   * wird der aktuelle Wert übergeben, bei Add ist `current === undefined`.
   */
  resolveDefaultValues: (editIndex: number | null, current: T | undefined) => T;

  /**
   * Rendert das Zeilen-Formular im Dialog.
   */
  renderRowForm: (props: EditableListSectionRowFormProps<T>) => ReactNode;

  addDialogTitle: string;
  editDialogTitle: string;
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
};

export const EditableListSection = <T,>({
  title,
  titleHelp,
  description,
  emptyHint,
  addLabel,
  fieldKeys,
  rows,
  renderRow,
  onAppend,
  onUpdate,
  onRemove,
  resolveDefaultValues,
  renderRowForm,
  addDialogTitle,
  editDialogTitle,
  confirmDeleteTitle,
  error,
  rowError,
  sortIndex,
}: EditableListSectionProps<T>) => {
  const [editTarget, setEditTarget] = useState<number | "new" | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const dialogOpen = editTarget !== null;
  const editIndex = typeof editTarget === "number" ? editTarget : null;
  const currentRow = editIndex !== null ? rows[editIndex] : undefined;
  const defaultValues = resolveDefaultValues(editIndex, currentRow);

  const closeDialog = () => setEditTarget(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          {title}
          {titleHelp}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction>
          <Button
            type="button"
            variant="ghostGreen"
            size="sm"
            onClick={() => setEditTarget("new")}
          >
            <RiAddLine />
            {addLabel}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-2">
        {fieldKeys.length === 0 && emptyHint ? (
          <Alert variant="info">
            <AlertDescription>{emptyHint}</AlertDescription>
          </Alert>
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
            <div
              key={key.id}
              data-invalid={rowErrorMessage ? true : undefined}
              className="rounded-md border border-border p-3 data-invalid:border-destructive data-invalid:bg-destructive/5"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">{renderRow(row, index)}</div>
                <div className="flex shrink-0 gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild={true}>
                      <Button
                        type="button"
                        variant="ghostBlue"
                        size="icon-sm"
                        onClick={() => setEditTarget(index)}
                        aria-label={t("ui.common.action.edit")}
                      >
                        <RiPencilLine />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t("ui.common.action.edit")}
                    </TooltipContent>
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
              {rowErrorMessage ? (
                <p className="mt-2 text-sm text-destructive">
                  {rowErrorMessage}
                </p>
              ) : null}
            </div>
          );
        })}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>

      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {editIndex !== null ? editDialogTitle : addDialogTitle}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            {editIndex !== null ? editDialogTitle : addDialogTitle}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {dialogOpen
            ? renderRowForm({
                defaultValues,
                editIndex,
                onSubmit: (values) => {
                  if (editIndex !== null) {
                    onUpdate(editIndex, values);
                  } else {
                    onAppend(values);
                  }
                  closeDialog();
                },
                onCancel: closeDialog,
              })
            : null}
        </ResponsiveDialogBody>
      </ResponsiveDialog>

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
    </Card>
  );
};
