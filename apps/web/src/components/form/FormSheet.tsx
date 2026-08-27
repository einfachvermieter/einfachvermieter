import type { RemixiconComponentType } from "@remixicon/react";
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
import { cn } from "../../lib/utils";

/**
 * Seitliches Formular-Sheet
 */
export const FormSheet = <T extends FieldValues>({
  form,
  icon: Icon,
  title,
  description,
  submitLabel,
  errorTitle,
  onSubmit,
  onClose,
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
  children: ReactNode;
}) => {
  const [rootError, setRootError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const scrollRef = useRef<HTMLFormElement>(null);

  // Bildlauf-Hinweis an den stehenden Leisten.
  const [overflow, setOverflow] = useState({ top: false, bottom: false });
  const { isDirty, isSubmitting } = form.formState;

  // Das Fehlerbanner sitzt ganz oben im Inhalt; bei Fehlern
  // dorthin scrollen, sonst bleibt es unsichtbar.
  useEffect(() => {
    if (rootError) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [rootError]);

  // Nach jedem Render prüfen: Aufklappende Felder ändern die Inhaltshöhe,
  // ohne dass gescrollt wird.
  const syncOverflow = () => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const top = element.scrollTop > 0;
    const bottom =
      element.scrollTop + element.clientHeight < element.scrollHeight - 1;
    setOverflow((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom },
    );
  };
  useEffect(syncOverflow);

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
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            onScroll={syncOverflow}
            onSubmit={form.handleSubmit(handleValid)}
          >
            <SheetHeader
              className={cn(
                "sticky top-0 z-10 border-b border-border bg-popover/70 backdrop-blur-lg",
                "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-schiefer-1000/10 after:to-transparent after:opacity-0 after:transition-opacity",
                overflow.top && "after:opacity-100",
              )}
            >
              <SheetTitle>
                {Icon ? (
                  <Icon
                    aria-hidden={true}
                    className="size-5 shrink-0 text-azur-700"
                  />
                ) : null}
                {title}
              </SheetTitle>
              {description ? (
                <SheetDescription>{description}</SheetDescription>
              ) : null}
            </SheetHeader>

            <fieldset disabled={isSubmitting} className="px-4 py-4">
              <div className="flex flex-col gap-4">
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

            <SheetFooter
              className={cn(
                "sticky bottom-0 mt-auto flex-row justify-end border-t border-border bg-popover/70 backdrop-blur-lg",
                "before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-3 before:bg-linear-to-t before:from-schiefer-1000/10 before:to-transparent before:opacity-0 before:transition-opacity",
                overflow.bottom && "before:opacity-100",
              )}
            >
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

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("ui.common.forms.unsavedTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("ui.common.forms.unsavedMessageClose")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">
              {t("ui.common.forms.unsavedKeepEditing")}
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onClose}>
              {t("ui.common.forms.unsavedDiscard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
