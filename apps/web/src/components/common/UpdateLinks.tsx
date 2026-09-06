import { appDistribution, type UpdateStatus } from "@einfachvermieter/shared";
import { RiExternalLinkLine } from "@remixicon/react";
import { t } from "@/lib/i18n";

const ExternalLink = ({ href, label }: { href: string; label: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 font-medium underline underline-offset-3 hover:text-foreground"
  >
    {label}
    <RiExternalLinkLine className="size-3.5" />
  </a>
);

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
