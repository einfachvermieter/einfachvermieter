import { RiDeleteBinLine, RiUploadCloud2Line } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import {
  type PendingLogo,
  previewSenderLogoPdf,
  type SenderSettings,
  senderLogoPreviewUrl,
  senderLogoUrl,
} from "@/lib/senderSettings";

const ACCEPT_ATTR = "image/png,image/jpeg,image/webp,image/svg+xml";
const SVG_MIME = "image/svg+xml";

/**
 * Native PDF-Viewer-Bedienelemente ausblenden (Best effort je nach Browser)
 */
const PDF_VIEWER_PARAMS = "#toolbar=0&navpanes=0&scrollbar=0";

/**
 * Briefkopf-Band: A4-Breite (210 mm) x 45 mm Höhe, dasselbe Verhältnis wie
 * die PDF-Vorschau, damit Raster-Logos identisch platziert wirken.
 */
const BAND_ASPECT = "210 / 45";

/**
 * Logo-Box innerhalb des Bandes, prozentual passend zu styles.senderLogo
 * (links 25 mm, oben 10 mm, 165 mm x 25 mm in einem 210 x 45 mm Band).
 */
const RASTER_LOGO_BOX = {
  left: "11.905%",
  top: "22.222%",
  width: "78.571%",
  height: "55.556%",
} as const;

type SenderLogoSectionProps = {
  settings: SenderSettings;
  pendingLogo: PendingLogo;
  onPendingLogoChange: (pending: PendingLogo) => void;
  logoVersion: string;
};

export const SenderLogoSection = ({
  settings,
  pendingLogo,
  onPendingLogoChange,
  logoVersion,
}: SenderLogoSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const pendingFile = pendingLogo?.kind === "replace" ? pendingLogo.file : null;
  const pendingIsSvg = pendingFile?.type === SVG_MIME;

  // SVG-Vorschau kommt aus dem PDF-Viewer (so rendert react-pdf es im echten
  // PDF. Die Browser-<img>-Darstellung weicht ggf. davon ab). Raster bleibt <img>.
  useEffect(() => {
    if (!pendingFile || pendingFile.type !== SVG_MIME) {
      setPreviewPdfUrl(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewLoading(true);
    setPreviewError(null);
    previewSenderLogoPdf(pendingFile)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPreviewPdfUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setPreviewError(
          err instanceof ApiError
            ? err.message
            : t("ui.settings.sender.logo.previewError"),
        );
        setPreviewPdfUrl(null);
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [pendingFile]);

  // Raster-Vorschau der noch nicht hochgeladenen Datei.
  const rasterPreviewUrl = useMemo(
    () =>
      pendingFile && pendingFile.type !== SVG_MIME
        ? URL.createObjectURL(pendingFile)
        : null,
    [pendingFile],
  );

  useEffect(
    () => () => {
      if (rasterPreviewUrl) {
        URL.revokeObjectURL(rasterPreviewUrl);
      }
    },
    [rasterPreviewUrl],
  );

  const storedIsSvg = settings.hasLogo && settings.logoMimeType === SVG_MIME;
  const hasVisibleLogo =
    pendingLogo?.kind === "replace" ||
    (pendingLogo === null && settings.hasLogo);

  const onFilesSelected = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }
    onPendingLogoChange({ kind: "replace", file });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const pdfFrame = (url: string) => (
    <div
      className="overflow-hidden rounded-md border border-foreground/10 bg-white"
      style={{ aspectRatio: BAND_ASPECT }}
    >
      <object
        data={`${url}${PDF_VIEWER_PARAMS}`}
        type="application/pdf"
        className="h-full w-full"
        aria-label={t("ui.settings.sender.logo.current")}
      />
    </div>
  );

  // Raster im A4-Band wie im finalen PDF platziert (object-contain in der
  // senderLogo-Box), statt nur zentriert. Simuliert die echte Einpassung
  const rasterFrame = (url: string) => (
    <div
      className="relative rounded-md border border-foreground/10 bg-white"
      style={{ aspectRatio: BAND_ASPECT }}
    >
      <img
        src={url}
        alt={t("ui.settings.sender.logo.current")}
        className="absolute object-contain"
        style={RASTER_LOGO_BOX}
      />
    </div>
  );

  const fallback = (
    <p className="text-sm text-muted-foreground">
      {t("ui.settings.sender.logo.fallback")}
    </p>
  );

  const renderPreview = () => {
    if (pendingLogo?.kind === "replace") {
      if (pendingIsSvg) {
        if (previewLoading) {
          return (
            <div
              className="flex items-center justify-center rounded-md border border-foreground/10 bg-white text-sm text-muted-foreground"
              style={{ aspectRatio: BAND_ASPECT }}
            >
              {t("ui.settings.sender.logo.previewLoading")}
            </div>
          );
        }
        return previewPdfUrl ? pdfFrame(previewPdfUrl) : null;
      }
      return rasterPreviewUrl ? rasterFrame(rasterPreviewUrl) : null;
    }

    if (pendingLogo?.kind === "delete" || !settings.hasLogo) {
      return fallback;
    }

    return storedIsSvg
      ? pdfFrame(senderLogoPreviewUrl(logoVersion))
      : rasterFrame(senderLogoUrl(logoVersion));
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("ui.settings.sender.logo.description")}
      </p>

      {renderPreview()}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => onFilesSelected(event.target.files)}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <RiUploadCloud2Line aria-hidden={true} />
          {hasVisibleLogo
            ? t("ui.settings.sender.logo.replaceAction")
            : t("ui.settings.sender.logo.uploadAction")}
        </Button>
        {hasVisibleLogo ? (
          <Button
            type="button"
            variant="ghostDestructive"
            onClick={() => onPendingLogoChange({ kind: "delete" })}
          >
            <RiDeleteBinLine aria-hidden={true} />
            {t("ui.settings.sender.logo.removeAction")}
          </Button>
        ) : null}
      </div>

      {previewError ? (
        <p className="text-sm text-destructive">{previewError}</p>
      ) : null}

      {pendingLogo ? (
        <p className="text-sm text-muted-foreground">
          {t("ui.settings.sender.logo.pendingHint")}
        </p>
      ) : null}
    </div>
  );
};
