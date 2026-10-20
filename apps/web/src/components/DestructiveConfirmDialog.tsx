import type { ReactNode } from "react";
import { IconTrash } from "@/lib/icons";
import { t } from "../lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "./ui/AlertDialog";

export const DestructiveConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  consequence,
  hint,
  confirmLabel = t("ui.common.action.confirmDelete"),
  cancelLabel = t("ui.common.action.cancel"),
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;

  /**
   * Was außer dem Angeklickten mit gelöscht wird; steht hervorgehoben in
   * einem Kasten
   */
  consequence?: ReactNode;

  /**
   * Hinweis nach der Folge, z. B. eine Alternative zum Löschen
   */
  hint?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent size="default">
      <AlertDialogHeader>
        <AlertDialogMedia className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-himbeere-50 text-himbeere-500 sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-5">
          <IconTrash />
        </AlertDialogMedia>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {/* Folge und Hinweis stehen in derselben Spalte wie die Frage */}
        <AlertDialogDescription asChild={true}>
          <div className="space-y-3">
            {description ? <p>{description}</p> : null}
            {consequence ? (
              <p className="rounded-lg bg-himbeere-50 px-3.5 py-2.5 text-himbeere-900">
                {consequence}
              </p>
            ) : null}
            {hint ? <p>{hint}</p> : null}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel variant="outline">{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onConfirm}>
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
