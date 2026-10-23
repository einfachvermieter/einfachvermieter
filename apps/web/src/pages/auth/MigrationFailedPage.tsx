import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "@/components/common/ExternalLink";
import { StartupNotice } from "@/components/common/StartupNotice";
import { ISSUES_URL } from "@/lib/appVersion";
import {
  migrationFailedDetails,
  migrationFailedText,
  migrationFailedTitle,
} from "@/lib/migrationFailed";
import { setupStatusQueryOptions } from "@/lib/setup";
import { useDocumentTitle } from "../../lib/documentTitle";
import { t } from "../../lib/i18n";

/**
 * Sperrseite, wenn die Einrichtung oder Aktualisierung der Datenbank beim
 * Start gescheitert ist: einziger erreichbarer Bildschirm. Sie nennt den Rückweg und hat
 * bewusst keinen Button, ein neuer Versuch braucht einen Neustart.
 */
export const MigrationFailedPage = () => {
  const { data: status } = useQuery(setupStatusQueryOptions);
  const failure = status?.migrationFailed;
  const title = failure
    ? migrationFailedTitle(failure)
    : t("ui.migrationFailed.title");
  useDocumentTitle(title);

  return (
    <StartupNotice
      title={title}
      description={failure ? migrationFailedText(failure) : undefined}
    >
      {failure ? (
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground text-sm">
          <p>{migrationFailedDetails(failure)}</p>
          <ExternalLink href={ISSUES_URL} label={t("ui.beta.issues")} />
        </div>
      ) : null}
    </StartupNotice>
  );
};
