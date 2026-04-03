/**
 * Default-Upload-Limit für Belege. Der Web-Client nutzt diesen Wert als
 * reinen Pre-Check-Hinweis.
 */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/**
 * Effektives Upload-Limit der API in Bytes. ENV `MAX_ATTACHMENT_MB`
 * (positive Ganzzahl) überschreibt den Default; sonst greift
 * {@link MAX_ATTACHMENT_BYTES}.
 */
export const attachmentMaxBytesFromEnv = (
  env: Record<string, string | undefined>,
): number => {
  const megabytes = Number.parseInt(env.MAX_ATTACHMENT_MB ?? "", 10);

  return Number.isFinite(megabytes) && megabytes > 0
    ? megabytes * 1024 * 1024
    : MAX_ATTACHMENT_BYTES;
};

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedAttachmentMimeType =
  (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];
