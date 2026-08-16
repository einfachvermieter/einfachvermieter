import { useEffect } from "react";
import { t } from "./i18n";

/**
 * Browser-Tab-Titel von spezifisch nach allgemein
 */
export const composeDocumentTitle = (trail: string[]): string =>
  [...trail, t("common.appName.EinfachVermieter")].join(
    t("ui.common.separators.dash"),
  );

/**
 * Setzt den Tab-Titel für Seiten ausserhalb der Breadcrumb-Shell (Login, 404)
 */
export const useDocumentTitle = (pageTitle: string) => {
  useEffect(() => {
    document.title = composeDocumentTitle([pageTitle]);
  }, [pageTitle]);
};
