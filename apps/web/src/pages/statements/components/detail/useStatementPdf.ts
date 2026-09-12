import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { toastApiError } from "@/lib/toastApiError";

/**
 * Dateiname aus `Content-Disposition`. Der Server kennt die fachlich richtige
 * Benennung, sein Vorschlag hat deshalb Vorrang vor dem Titel der Seite.
 */
export const filenameFromHeader = (header: string | null): string => {
  if (!header) {
    return "";
  }

  const encoded = /filename\*=UTF-8''([^;]+)/iu.exec(header)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return "";
    }
  }

  return /filename="?([^";]+)"?/iu.exec(header)?.[1] ?? "";
};

/**
 * Holt das PDF als Blob, nicht als Link: Ein Serverfehler würde das Fenster
 * sonst auf die JSON-Antwort navigieren und die Anwendung verlassen!
 */
const fetchPdf = async (
  url: string,
): Promise<{ blob: Blob; filename: string }> => {
  const response = await fetch(url);
  if (!response.ok) {
    const raw = await response.text();
    let message = "";
    try {
      message = String(
        (JSON.parse(raw) as { message?: unknown }).message ?? "",
      );
    } catch {
      message = "";
    }
    throw new ApiError(response.status, message);
  }

  return {
    blob: await response.blob(),
    filename: filenameFromHeader(response.headers.get("content-disposition")),
  };
};

/**
 * Speichert das PDF unter dem Namen, den der Server vorgibt. Schlägt das
 * Rendern fehl, erscheint der Servertext als Toast und die Ansicht bleibt
 * stehen.
 */
export const downloadStatementPdf = (
  url: string,
  fallbackName: string,
): void => {
  fetchPdf(url)
    .then(({ blob, filename }) => {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename || `${fallbackName}.pdf`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    })
    .catch(toastApiError(t("ui.statements.detail.pdfFailedTitle")));
};

/**
 * Vorschau als Blob-Adresse. Fehler bleiben in der Query, damit der Reiter
 * sie anzeigen kann, statt eine leere Fläche zu zeigen.
 */
export const useStatementPdfPreview = (src: string, cacheKey: string) => {
  return useQuery({
    queryKey: ["statementPdf", cacheKey],
    // Nur prüfen, ob der Server das PDF liefert. Angezeigt wird danach die
    // direkte Adresse, weil der Betrachter keine Blob-Adressen anzeigt.
    queryFn: async () => {
      await fetchPdf(src);
      return true;
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
};
