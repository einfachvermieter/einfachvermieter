import { useEffect } from "react";
import { composeDocumentTitle } from "../lib/documentTitle";
import { useBreadcrumbTrail } from "./useBreadcrumbTrail";

/**
 * Setzt den Browser-Tab-Titel aus der Breadcrumb in umgekehrter Reihenfolge
 * (spezifisch -> allgemein), abgeschlossen mit dem Markennamen. Rendert nichts.
 */
export const DocumentTitle = () => {
  const trail = useBreadcrumbTrail();
  const documentTitle = composeDocumentTitle(
    [...trail]
      .reverse()
      .map((entry) => entry.label)
      .filter((label) => label.length > 0),
  );

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return null;
};
