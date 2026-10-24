import type { RemixiconComponentType } from "@remixicon/react";
// biome-ignore lint/suspicious/noDeprecatedImports: False positive, nur overloads deprecated
import { useBlocker } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Spinner } from "@/components/common/Spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { applyApiFieldErrors } from "../../lib/formErrors";
import { t } from "../../lib/i18n";

/**
 * Seitliches Formular-Sheet
 */
export const FormSheet = <T extends FieldValues>({
  form,
  title,
  description,
  submitLabel,
  errorTitle,
  onSubmit,
  onClose,
  footerStart,
  children,
}: {
  form: UseFormReturn<T>;
  icon?: RemixiconComponentType;
  title: string;
  description?: string;
  submitLabel: string;
  errorTitle?: string;
  onSubmit: (values: T) => Promise<void>;
  onClose: () => void;
  /**
   * Zusätzliche Aktion links im Footer, z. B. Löschen
   */
  footerStart?: ReactNode;
  children: ReactNode;
}) => {
  const [rootError, setRootError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const scrollRef = useRef<HTMLFormElement>(null);

  const { isDirty, isSubmitting } = form.formState;

  // Router-Navigation (Zurück-Button etc.) muss bei dirty Forms auch
  // warnen, dass Daten verloren gehen.
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty && !isSubmitting,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  });
  const navigationBlocked = blocker.status === "blocked";

  // Das Fehlerbanner sitzt ganz oben im Inhalt; bei Fehlern
  // dorthin scrollen, sonst bleibt es unsichtbar.
  useEffect(() => {
    if (rootError) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [rootError]);

  const requestClose = () => {
    if (isSubmitting) {
      return;
    }
    if (isDirty) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  const handleValid = async (values: T) => {
    try {
      await onSubmit(values);
      setRootError(null);
    } catch (err) {
      setRootError(applyApiFieldErrors(form, err));
    }
  };

  return (
    <>
      <Sheet
        open={true}
        onOpenChange={(open) => {
          if (!open) {
            requestClose();
          }
        }}
      >
        <SheetContent size="form" className="gap-0">
          <form
            ref={scrollRef}
            noValidate={true}
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto"
            onSubmit={form.handleSubmit(handleValid)}
          >
            <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover px-7 py-4.5">
              <SheetTitle>{title}</SheetTitle>
              {description ? (
                <SheetDescription>{description}</SheetDescription>
              ) : null}
            </SheetHeader>

            {/* Zwischen den Feldern 24px, innerhalb eines Felds 6px: so steht jedes Feld als eigener Block */}
            <fieldset
              disabled={isSubmitting}
              className="min-w-0 px-7 pt-6 pb-8"
            >
              <div className="flex min-w-0 flex-col gap-6">
                {rootError ? (
                  <Alert variant="error">
                    <AlertTitle>
                      {errorTitle ?? t("common.saveFailed")}
                    </AlertTitle>
                    <AlertDescription>{rootError}</AlertDescription>
                  </Alert>
                ) : null}
                {children}
              </div>
            </fieldset>

            <SheetFooter className="sticky bottom-0 mt-auto flex-row justify-end border-t border-border bg-azur-50 px-7 py-4">
              {footerStart ? (
                <div className="mr-auto">{footerStart}</div>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={requestClose}
                disabled={isSubmitting}
              >
                {t("ui.common.action.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                {submitLabel}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirmDiscard || navigationBlocked}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDiscard(false);
            blocker.reset?.();
          }
        }}
      >
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("ui.common.forms.unsavedTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {navigationBlocked
                ? t("ui.common.forms.unsavedMessage")
                : t("ui.common.forms.unsavedMessageClose")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">
              {t("ui.common.forms.unsavedKeepEditing")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (navigationBlocked) {
                  blocker.proceed?.();
                } else {
                  onClose();
                }
              }}
            >
              {t("ui.common.forms.unsavedDiscard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
