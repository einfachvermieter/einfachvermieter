import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { t } from "../../lib/i18n";
import type { FormSyncState } from "./useFormSync";

/**
 * Standard-UI für den Sync-Prompt. Erwartet das State-Objekt aus
 * `useFormSync`. Rendert `null`, wenn kein Prompt nötig ist.
 */
export const FormSyncPrompt = ({
  showPrompt,
  acceptServerVersion,
  keepLocalChanges,
}: FormSyncState) => {
  if (!showPrompt) {
    return null;
  }

  return (
    <Alert variant="warning">
      <AlertTitle>{t("ui.common.formSync.title")}</AlertTitle>
      <AlertDescription>
        <p>{t("ui.common.formSync.message")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={acceptServerVersion}>
            {t("ui.common.formSync.actionReload")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={keepLocalChanges}
          >
            {t("ui.common.formSync.actionKeep")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
