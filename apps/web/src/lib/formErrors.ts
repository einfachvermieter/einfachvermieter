import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { ApiError } from "./api";
import { t } from "./i18n";

/**
 * Spielt Server-Validierungsfehler in den react-hook-form-State ein.
 * Feld-Fehler erscheinen dadurch inline am jeweiligen Feld, genau wie
 * Zod-Client-Fehler.
 *
 * @returns Ein eventueller Formular-übergreifender Fehler (path=[]) oder eine
 *   generische Meldung bei Nicht-Feld-Fehlern (Netzwerk/500); `null`, wenn alle
 *   Fehler Feldern zugeordnet werden konnten.
 */
export const applyApiFieldErrors = <
  T extends FieldValues,
  TTransformed extends FieldValues = T,
>(
  form: UseFormReturn<T, unknown, TTransformed>,
  err: unknown,
): string | null => {
  if (err instanceof ApiError && err.fieldErrors) {
    let rootMessage: string | null = null;

    for (const fe of err.fieldErrors) {
      if (fe.path.length === 0) {
        rootMessage = fe.message;
        continue;
      }

      form.setError(fe.path.join(".") as FieldPath<T>, {
        type: "server",
        message: fe.message,
      });
    }

    return rootMessage;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return t("common.saveFailed");
};
