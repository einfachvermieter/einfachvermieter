import { RiDeleteBinLine } from "@remixicon/react";
import type { ReactNode } from "react";
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
  confirmLabel = t("ui.common.action.confirm"),
  cancelLabel = t("ui.common.action.cancel"),
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent size="default">
      <AlertDialogHeader>
        <AlertDialogMedia className="mb-2 inline-flex size-10 items-center justify-center rounded-md sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6 bg-destructive/10 text-destructive">
          <RiDeleteBinLine />
        </AlertDialogMedia>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
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
