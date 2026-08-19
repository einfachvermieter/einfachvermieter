import type { UpdateStatus } from "@einfachvermieter/shared";
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
 * Links zu einer neuen Version: je Plattform Download (macOS), Store
 * (Windows) oder Anleitung (Server) und, falls vorhanden, Release-Notes.
 */
export const UpdateLinks = ({ status }: { status: UpdateStatus }) => {
  if (!status.downloadUrl) {
    return null;
  }

  const downloadLabel = {
    server: t("ui.updates.instructions"),
    win: t("ui.updates.store"),
    macos: t("ui.updates.download"),
  }[status.platform];

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
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
