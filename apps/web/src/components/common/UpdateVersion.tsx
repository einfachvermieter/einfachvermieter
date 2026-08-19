import { formatDate } from "@einfachvermieter/shared";
import { t } from "@/lib/i18n";

/**
 * Versionsbezeichnung "v1.2.0", mit Datum in Klammern, wenn bekannt
 */
export const UpdateVersion = ({
  version,
  availableFrom = null,
}: {
  version: string;
  availableFrom?: string | null;
}) => (
  <span>
    {availableFrom
      ? t("ui.updates.versionWithDate", {
          version,
          date: formatDate(availableFrom.slice(0, 10)),
        })
      : t("ui.updates.version", { version })}
  </span>
);
