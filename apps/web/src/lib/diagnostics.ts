/**
 * Fehlerbericht zum Verschicken. Der Server liefert seinen Teil als Text,
 * die Oberfläche stellt voran, was nur sie weiß.
 */

import {
  reportFileStamp,
  reportSection,
} from "@einfachvermieter/shared/diagnostics";
import { t } from "./i18n";
import { toastApiError } from "./toastApiError";

const REPORT_PATH = "/api/diagnostics/report";

const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }

  return error === undefined ? t("report.noError") : String(error);
};

const browserSection = (error: unknown): string => {
  const lines = [
    t("report.heading"),
    t("report.createdAt", { value: new Date().toLocaleString("de-DE") }),
    t("report.version", { value: __APP_VERSION__ }),
    t("report.address", { value: window.location.href }),
    t("report.browser", { value: navigator.userAgent }),
    ...reportSection(t("report.errorSection"), describeError(error)),
  ];

  return lines.join("\n");
};

const withoutHeading = (text: string): string => {
  const heading = `${t("report.heading")}\n`;
  return text.startsWith(heading) ? text.slice(heading.length) : text;
};

const fetchServerReport = async (): Promise<string> => {
  try {
    const response = await fetch(REPORT_PATH, { credentials: "include" });
    if (!response.ok) {
      return t("report.serverUnavailable", { message: response.status });
    }

    return withoutHeading(await response.text());
  } catch (error) {
    return t("report.serverUnavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const saveAsFile = (report: string): void => {
  const objectUrl = URL.createObjectURL(
    new Blob([report], { type: "text/plain;charset=utf-8" }),
  );

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = t("report.fileName", { stamp: reportFileStamp(new Date()) });
  link.click();
  URL.revokeObjectURL(objectUrl);
};

/**
 * Lädt den Bericht als Textdatei herunter.
 */
export const downloadDiagnosticsReport = (error?: unknown): void => {
  fetchServerReport()
    .then((serverReport) =>
      saveAsFile(
        [
          browserSection(error),
          ...reportSection(t("report.serverSection"), serverReport),
          "",
        ].join("\n"),
      ),
    )
    .catch(toastApiError(t("ui.settings.about.reportFailed")));
};
