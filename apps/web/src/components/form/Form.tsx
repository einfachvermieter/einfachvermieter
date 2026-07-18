// biome-ignore lint/suspicious/noDeprecatedImports: Nur die Legacy-Overloads von useBlocker sind deprecated. Genutzt wird die aktuelle UseBlockerOpts-Objekt-Syntax.
import { useBlocker } from "@tanstack/react-router";
import { type ReactNode, useId, useRef, useState } from "react";
import type { FieldErrors, FieldValues, UseFormReturn } from "react-hook-form";
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
import { t } from "@/lib/i18n";
import { applyApiFieldErrors } from "../../lib/formErrors";

const logInvalidSubmit = <T extends FieldValues>(errors: FieldErrors<T>) => {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: import.meta.env.DEV is a Vite compile-time constant, not a runtime env var
  if (!import.meta.env.DEV) {
    return;
  }

  console.error("[Form] validation failed", errors);
};

export const Form = <
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues = TFieldValues,
>({
  form,
  onSubmit,
  children,
  errorTitle = t("common.saveFailed"),
  guardUnsavedChanges = true,
}: {
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>;
  onSubmit: (values: TTransformedValues) => Promise<void>;
  children: ReactNode;
  errorTitle?: string;

  /**
   * Kann für unkritische Formulare wie z.B. Passwort ändern auf false
   * gesetzt werden, um nach ungespeicherten Änderungen wegnavigieren zu können.
   */
  guardUnsavedChanges?: boolean;
}) => {
  const id = useId();
  const [rootError, setRootError] = useState<string | null>(null);

  // Dirty-State-Schutz: ungespeicherte Änderungen blocken SPA-Navigation
  // (Bestätigungs-Dialog) und Tab-Schließen (beforeunload). Während des
  // Submits ist Navigation erlaubt (onSuccess navigiert weg, bevor der
  // Submit-Handler zurückkehrt); nach erfolgreichem Submit dauerhaft.
  //
  // `isDirty`/`isSubmitting` MÜSSEN hier im Render destrukturiert werden:
  // react-hook-forms `formState` ist ein Proxy, der nur aktualisiert, was
  // im Render gelesen wurde. Würde der Blocker sie nur in seiner Callback
  // lesen, blieben sie stale (immer false). Der Dialog käme nie.
  const { isDirty, isSubmitting } = form.formState;
  const submitSucceededRef = useRef(false);
  const blocker = useBlocker({
    shouldBlockFn: () =>
      isDirty && !isSubmitting && !submitSucceededRef.current,
    enableBeforeUnload: () => isDirty && !submitSucceededRef.current,
    disabled: !guardUnsavedChanges,
    withResolver: true,
  });

  const handleValid = async (values: TTransformedValues) => {
    setRootError(null);
    try {
      await onSubmit(values);
      submitSucceededRef.current = true;
    } catch (err) {
      setRootError(applyApiFieldErrors(form, err));
    }
  };

  return (
    <>
      <form
        id={id}
        onSubmit={form.handleSubmit(handleValid, logInvalidSubmit)}
        noValidate={true}
        className="flex flex-col gap-6"
      >
        {rootError ? (
          <Alert variant="error">
            <AlertTitle>{errorTitle}</AlertTitle>
            <AlertDescription>{rootError}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </form>

      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) {
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
              {t("ui.common.forms.unsavedMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              variant="outline"
              onClick={() => blocker.reset?.()}
            >
              {t("ui.common.forms.unsavedStay")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => blocker.proceed?.()}
            >
              {t("ui.common.forms.unsavedDiscard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
