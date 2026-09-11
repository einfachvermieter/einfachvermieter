import { appDistribution, type UpdateStatus } from "@einfachvermieter/shared";
import { ExternalLink } from "@/components/common/ExternalLink";
import { t } from "@/lib/i18n";

/**
 * Links zu einer neuen Version: je Veröffentlichungsweg Download, Store oder
 * Aktualisierungs-Anleitung (Server) und, falls vorhanden, Release-Notes.
 */
export const UpdateLinks = ({ status }: { status: UpdateStatus }) => {
  if (!status.downloadUrl) {
    return null;
  }

  const downloadLabel = {
    instructions: t("ui.updates.instructions"),
    store: t("ui.updates.store"),
    download: t("ui.updates.download"),
  }[appDistribution(status.platform)];

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <ExternalLink href={status.downloadUrl} label={downloadLabel} />
      {status.releaseNotesUrl ? (
        <ExternalLink
          href={status.releaseNotesUrl}
          label={t("ui.updates.releaseNotes")}
        />
      ) : null}
    </span>
  );
};
