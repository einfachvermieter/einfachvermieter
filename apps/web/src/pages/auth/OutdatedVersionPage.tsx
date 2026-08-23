import { useQuery } from "@tanstack/react-query";
import { StartupNotice } from "@/components/common/StartupNotice";
import { setupStatusQueryOptions } from "@/lib/setup";
import { useDocumentTitle } from "../../lib/documentTitle";
import { t } from "../../lib/i18n";

/**
 * Sperrseite, wenn die Datenbank zuletzt von einer neueren App-Version
 * benutzt wurde: einziger erreichbarer Bildschirm, bis die aktuelle Version
 * läuft.
 */
export const OutdatedVersionPage = () => {
  useDocumentTitle(t("ui.outdatedVersion.title"));
  const { data: status } = useQuery(setupStatusQueryOptions);
  const versions = status?.databaseNewerThanApp;

  return (
    <StartupNotice
      title={t("ui.outdatedVersion.title")}
      description={
        versions ? t("ui.outdatedVersion.description", versions) : undefined
      }
    />
  );
};
