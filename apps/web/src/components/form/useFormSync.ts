import { useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type UseFormSyncOptions<T extends FieldValues> = {
  form: UseFormReturn<T>;

  /**
   * Aktuell vom Server gelieferte Default-Values. Bei serverseitigen
   * Updates wird das Formular hierauf zurückgesetzt, entweder still
   * (wenn nicht dirty) oder nach Bestätigung des Prompts.
   */
  defaultValues: T;

  /**
   * Versionskennung der Server-Daten (z. B. `updatedAt`). Nur Änderungen
   * dieses Werts triggern eine Sync-Prüfung.
   */
  serverVersion: string | undefined;
};

export type FormSyncState = {
  showPrompt: boolean;

  /**
   * Server-Stand übernehmen: verwirft lokale Änderungen.
   */
  acceptServerVersion: () => void;

  /**
   * Lokale Änderungen behalten und Server-Update bewusst ignorieren.
   */
  keepLocalChanges: () => void;
};

/**
 * Hält ein Formular mit serverseitigen Updates synchron:
 *
 * - Wenn der `serverVersion`-Marker sich ändert und das Form nicht dirty
 *   ist, wird es still mit den neuen `defaultValues` zurückgesetzt.
 *
 * - Ist das Form dirty, signalisiert der Hook über `showPrompt`, dass
 *   der Anwender entscheiden soll. `acceptServerVersion` resettet,
 *   `keepLocalChanges` ignoriert das Update für die laufende Session.
 */
export const useFormSync = <T extends FieldValues>({
  form,
  defaultValues,
  serverVersion,
}: UseFormSyncOptions<T>): FormSyncState => {
  const acknowledgedVersionRef = useRef(serverVersion);
  const defaultValuesRef = useRef(defaultValues);
  defaultValuesRef.current = defaultValues;
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (serverVersion === undefined) {
      return;
    }
    if (serverVersion === acknowledgedVersionRef.current) {
      return;
    }
    if (form.formState.isDirty) {
      setShowPrompt(true);
    } else {
      form.reset(defaultValuesRef.current);
      acknowledgedVersionRef.current = serverVersion;
    }
  }, [serverVersion, form]);

  return {
    showPrompt,

    acceptServerVersion: () => {
      form.reset(defaultValuesRef.current);
      acknowledgedVersionRef.current = serverVersion;
      setShowPrompt(false);
    },

    keepLocalChanges: () => {
      acknowledgedVersionRef.current = serverVersion;
      setShowPrompt(false);
    },
  };
};
