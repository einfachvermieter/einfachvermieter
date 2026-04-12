import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { getI18n } from "../i18n/i18n.registry.js";

/**
 * Prüft MIME-Typ und Größe eines Uploads und wirft lokalisierte Exceptions.
 * Gemeinsam genutzt von Logo-, Anhangs- und KI-Extraktions-Upload.
 */
export const assertUploadAllowed = (
  mimeType: string,
  sizeBytes: number,
  allowedMimeTypes: ReadonlySet<string>,
  maxBytes: number,
): void => {
  const i18n = getI18n();
  if (!allowedMimeTypes.has(mimeType)) {
    throw new UnsupportedMediaTypeException(
      i18n.t("errors.upload.unsupportedType", { mimeType }),
    );
  }
  if (sizeBytes > maxBytes) {
    throw new PayloadTooLargeException(
      i18n.t("errors.upload.tooLarge", {
        maxMb: Math.round(maxBytes / (1024 * 1024)),
      }),
    );
  }
};
