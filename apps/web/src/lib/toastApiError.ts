import { toast } from "sonner";
import { ApiError } from "./api";
import { t } from "./i18n";

/**
 * Fehlerzweig für Mutationen außerhalb von Formularen: zeigt den fachlichen
 * Text des Servers als Toast
 */
export const toastApiError = (fallbackMessage?: string) => (err: unknown) => {
  const message = err instanceof ApiError ? err.message.trim() : "";
  toast.error(message || fallbackMessage || t("common.actionFailed"));
};
