import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { ApiError } from "./api";
import { t } from "./i18n";

/**
 * Prüft, ob der vom Server gemeldete Pfad im aktuellen Formular vorkommt.
 */
const hasField = (values: FieldValues, path: (string | number)[]): boolean => {
  let current: unknown = values;
  for (const segment of path) {
    if (current === null || typeof current !== "object") {
      return false;
    }
    if (!(String(segment) in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return true;
};

/**
 * Spielt Server-Validierungsfehler in den react-hook-form-State ein.
 * Feld-Fehler erscheinen dadurch inline am jeweiligen Feld, genau wie
 * Zod-Client-Fehler.
 *
 * @returns Ein eventueller Formular-übergreifender Fehler (path=[] oder ein
 *   Pfad, den dieses Formular nicht kennt) oder eine generische Meldung bei
 *   Nicht-Feld-Fehlern (Netzwerk/500); `null`, wenn alle Fehler Feldern
 *   zugeordnet werden konnten.
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

    const values = form.getValues();

    for (const fieldError of err.fieldErrors) {
      // Ein Fehler ohne Pfad und ein Fehler auf ein hier nicht vorhandenes
      // Feld landen beide über der Schaltflächenzeile.
      if (fieldError.path.length === 0 || !hasField(values, fieldError.path)) {
        rootMessage ??= fieldError.message;
        continue;
      }

      form.setError(fieldError.path.join(".") as FieldPath<T>, {
        type: "server",
        message: fieldError.message,
      });
    }

    return rootMessage;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return t("common.saveFailed");
};
