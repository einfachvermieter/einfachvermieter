import {
  type CalcWarning,
  formatWarningParams,
} from "@einfachvermieter/shared";
import { t } from "./i18n.js";

/**
 * Übersetzt eine sprachneutrale Calc-Warnung für die Anzeige im Dokument.
 * Wichtig v. a. für die rechtlich gebotene Kennzeichnung geschätzter
 * Ablesewerte (`readingEstimated`).
 */
export const formatCalcWarning = (warning: CalcWarning): string => {
  const params = formatWarningParams(warning.params);
  const message = t(`warnings.${warning.code}`, params);
  return typeof params.label === "string"
    ? t("warnings.labeled", { label: params.label, message })
    : message;
};

export const calcWarningKey = (warning: CalcWarning): string =>
  `${warning.code}:${JSON.stringify(warning.params ?? {})}`;
