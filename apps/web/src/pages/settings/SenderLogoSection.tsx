import type {
  SenderLogoAlignment,
  SenderLogoMode,
} from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiUploadCloud2Line } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import appLogoUrl from "@/img/logo/logo_light.svg";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import {
  type PendingLogo,
  previewSenderLogoPdf,
  type SenderSettings,
  senderLogoUrl,
} from "@/lib/senderSettings";
import {
  SenderLetterPreview,
  type SenderLetterValues,
} from "./SenderLetterPreview";

const ACCEPT_ATTR = "image/png,image/jpeg,image/webp,image/svg+xml";
const SVG_MIME = "image/svg+xml";

const LOGO_AREA_LEFT = 11.905;
const LOGO_AREA_WIDTH = 78.571;
const LOGO_AREA_HEIGHT = 55.556;

const LOGO_OFFSET_FACTOR: Record<SenderLogoAlignment, number> = {
  left: 0,
  center: 0.5,
  right: 1,
};

const LOGO_OBJECT_POSITION: Record<SenderLogoAlignment, string> = {
  left: "left center",
  center: "center",
  right: "right center",
};

const logoBox = (alignment: SenderLogoAlignment, scalePercent: number) => {
  const scale = scalePercent / 100;
  const width = LOGO_AREA_WIDTH * scale;
  const freeSpace = LOGO_AREA_WIDTH - width;

  return {
    left: `${LOGO_AREA_LEFT + freeSpace * LOGO_OFFSET_FACTOR[alignment]}%`,
    top: "22.222%",
    width: `${width}%`,
    height: `${LOGO_AREA_HEIGHT * scale}%`,
    objectPosition: LOGO_OBJECT_POSITION[alignment],
  };
};

type SenderLogoSectionProps = {
  settings: SenderSettings;
  letterValues: SenderLetterValues;
  logoMode: SenderLogoMode;
  logoAlignment: SenderLogoAlignment;
  logoScalePercent: number;
  pendingLogo: PendingLogo;
  onPendingLogoChange: (pending: PendingLogo) => void;
  logoVersion: string;
};

export const SenderLogoSection = ({
  settings,
  letterValues,
  logoMode,
  logoAlignment,
  logoScalePercent,
  pendingLogo,
  onPendingLogoChange,
  logoVersion,
}: SenderLogoSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const pendingFile = pendingLogo?.kind === "replace" ? pendingLogo.file : null;

  // Gezeigt wird das SVG als Bild; das PDF wird trotzdem gerendert, weil sich
  // nur so zeigt, ob react-pdf mit der Datei zurechtkommt. Scheitert es,
  // erscheint der Fehler unter der Vorschau.
  useEffect(() => {
    if (!pendingFile || pendingFile.type !== SVG_MIME) {
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    previewSenderLogoPdf(pendingFile)
      .then(() => {
        if (!cancelled) {
          setPreviewError(null);
        }
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
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pendingFile]);

  // Raster-Vorschau der noch nicht hochgeladenen Datei.
  const filePreviewUrl = useMemo(
    () => (pendingFile ? URL.createObjectURL(pendingFile) : null),
    [pendingFile],
  );

  useEffect(
    () => () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    },
    [filePreviewUrl],
  );

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

  // Logo im A4-Band wie im finalen PDF platziert
  // Simuliert die echte Einpassung
  const logoFrame = (url: string) => (
    <div className="relative h-full w-full">
      <img
        src={url}
        alt={t("ui.settings.sender.logo.current")}
        className="absolute object-contain"
        style={logoBox(logoAlignment, logoScalePercent)}
      />
    </div>
  );

  const missingLogoNote = (
    <div className="relative h-full w-full">
      <span
        className="absolute flex items-center text-2xs text-muted-foreground"
        style={logoBox(logoAlignment, logoScalePercent)}
      >
        {t("ui.settings.sender.logo.fallback")}
      </span>
    </div>
  );

  const renderPreview = () => {
    if (logoMode === "none") {
      return null;
    }

    if (logoMode === "app") {
      return logoFrame(appLogoUrl);
    }

    if (pendingLogo?.kind === "replace") {
      return filePreviewUrl ? logoFrame(filePreviewUrl) : null;
    }

    if (pendingLogo?.kind === "delete" || !settings.hasLogo) {
      return missingLogoNote;
    }

    return logoFrame(senderLogoUrl(logoVersion));
  };

  return (
    <div className="flex flex-col gap-4">
      <SenderLetterPreview values={letterValues} logo={renderPreview()} />
      <p className="text-xs text-muted-foreground">
        {t("ui.settings.sender.preview.note")}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => onFilesSelected(event.target.files)}
      />

      {logoMode === "own" ? (
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
      ) : null}

      {previewLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("ui.settings.sender.logo.previewLoading")}
        </p>
      ) : null}

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
