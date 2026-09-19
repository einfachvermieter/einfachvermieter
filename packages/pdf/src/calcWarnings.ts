import {
  type CalcWarningGroup,
  formatWarningLabels,
  formatWarningParams,
} from "@einfachvermieter/shared";
import { t } from "./i18n.js";

/**
 * Übersetzt eine gebündelte Berechnungswarnung für die Anzeige im Dokument.
 * Wichtig v. a. für die rechtlich gebotene Kennzeichnung geschätzter
 * Ablesewerte (`readingEstimated`). Trägt die Warnung Zähler-Labels,
 * gefolgt von der Liste der Betroffenen hinter der Nachricht.
 */
export const formatCalcWarning = (group: CalcWarningGroup): string => {
  const params = formatWarningParams(group.params);
  const message = t(`warnings.${group.code}`, params);

  if (group.labels.length > 0) {
    return t("warnings.affected", {
      message,
      labels: formatWarningLabels(group, (key, labelParams) =>
        t(key, labelParams),
      ).join(", "),
    });
  }
  return message;
};

export const calcWarningKey = (group: CalcWarningGroup): string =>
  `${group.code}:${JSON.stringify(group.params ?? {})}`;
