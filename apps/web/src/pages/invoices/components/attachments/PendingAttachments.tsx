import { formatBytes } from "@einfachvermieter/shared";
import {
  RiAiGenerate2Line,
  RiAttachment2,
  RiDeleteBinLine,
  RiEyeLine,
  RiFileLine,
  RiFilePdf2Line,
  RiImageLine,
  RiLoader4Line,
  RiUploadCloud2Line,
} from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { isMistralSupported } from "../../../../lib/aiExtraction";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ATTACHMENT_ACCEPT_ATTR,
  MAX_ATTACHMENT_BYTES,
} from "../../../../lib/attachments";
import { t } from "../../../../lib/i18n";

const fileIcon = (file: File) => {
  if (file.type === "application/pdf") {
    return (
      <RiFilePdf2Line className="size-5 text-rose-700" aria-hidden={true} />
    );
  }
  if (file.type.startsWith("image/")) {
    return <RiImageLine className="size-5 text-teal-700" aria-hidden={true} />;
  }
  return <RiFileLine className="size-5 text-stone-500" aria-hidden={true} />;
};

const isAllowed = (file: File): boolean =>
  (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type);

export const PendingAttachments = ({
  files,
  onChange,
  disabled,
  onExtract,
  extractingFile,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  onExtract?: (file: File) => void;
  extractingFile?: File | null;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const urlCacheRef = useRef<Map<File, string>>(new Map());

  // Stabile blob-URL pro File: einmal erzeugen, beim Entfernen revoken,
  // damit offene Vorschauen nicht abreißen, wenn nebenher weitere Dateien
  // hinzukommen.
  const previewUrls = files.map((file) => {
    const cached = urlCacheRef.current.get(file);
    if (cached) {
      return cached;
    }
    const url = URL.createObjectURL(file);
    urlCacheRef.current.set(file, url);
    return url;
  });

  useEffect(() => {
    const cache = urlCacheRef.current;
    const present = new Set(files);
    for (const [file, url] of cache.entries()) {
      if (!present.has(file)) {
        URL.revokeObjectURL(url);
        cache.delete(file);
      }
    }
  }, [files]);

  useEffect(
    () => () => {
      const cache = urlCacheRef.current;
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
      cache.clear();
    },
    [],
  );

  const onFilesSelected = (selected: FileList | null) => {
    if (!selected || selected.length === 0) {
      return;
    }
    setErrorMessage(null);
    const accepted: File[] = [];
    for (const file of Array.from(selected)) {
      if (!isAllowed(file)) {
        setErrorMessage(
          t("ui.invoices.attachments.invalidType", { filename: file.name }),
        );
        continue;
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        setErrorMessage(
          t("ui.invoices.attachments.tooLarge", {
            filename: file.name,
            limit: formatBytes(MAX_ATTACHMENT_BYTES),
          }),
        );
        continue;
      }

      accepted.push(file);
    }

    if (accepted.length > 0) {
      onChange([...files, ...accepted]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAt = (index: number) => {
    if (previewIndex === index) {
      setPreviewIndex(null);
    } else if (previewIndex !== null && previewIndex > index) {
      setPreviewIndex(previewIndex - 1);
    }
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiAttachment2 className="size-5" aria-hidden={true} />
          {t("ui.invoices.attachments.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT_ATTR}
            multiple={true}
            className="hidden"
            onChange={(event) => onFilesSelected(event.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <RiUploadCloud2Line aria-hidden={true} />
            {t("ui.invoices.attachments.upload")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("ui.invoices.attachments.hintDeferred", {
              limit: formatBytes(MAX_ATTACHMENT_BYTES),
            })}
          </span>
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("ui.invoices.attachments.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-md border border-foreground/10">
            {files.map((file, index) => {
              const isOpen = previewIndex === index;
              const url = previewUrls[index];
              return (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: pending files have no stable id
                  key={`${file.name}-${index}`}
                  className="flex flex-col"
                >
                  <div className="flex items-center gap-3 px-3 py-2">
                    {fileIcon(file)}
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(isOpen ? null : index)}
                      className="flex-1 truncate text-left text-sm font-medium hover:underline"
                      title={file.name}
                    >
                      {file.name}
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatBytes(file.size)}
                    </span>
                    {onExtract && isMistralSupported(file.type) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onExtract(file)}
                        disabled={disabled === true || Boolean(extractingFile)}
                        aria-label={t("ui.invoices.aiExtract.buttonAriaLabel")}
                        title={t("ui.invoices.aiExtract.button")}
                      >
                        {extractingFile === file ? (
                          <RiLoader4Line
                            aria-hidden={true}
                            className="animate-spin"
                          />
                        ) : (
                          <RiAiGenerate2Line aria-hidden={true} />
                        )}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewIndex(isOpen ? null : index)}
                      aria-label={t("ui.invoices.attachments.preview")}
                    >
                      <RiEyeLine aria-hidden={true} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAt(index)}
                      disabled={disabled}
                      aria-label={t("ui.invoices.attachments.delete")}
                    >
                      <RiDeleteBinLine
                        aria-hidden={true}
                        className="text-destructive"
                      />
                    </Button>
                  </div>
                  {isOpen && url ? (
                    <PendingPreview file={file} url={url} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

const PendingPreview = ({ file, url }: { file: File; url: string }) => {
  if (file.type === "application/pdf") {
    return (
      <div className="border-t border-foreground/10 bg-stone-50 p-3">
        <iframe
          src={url}
          title={file.name}
          className="h-[70vh] w-full rounded-md border border-foreground/10 bg-white"
        />
      </div>
    );
  }

  if (file.type.startsWith("image/")) {
    return (
      <div className="flex justify-center border-t border-foreground/10 bg-stone-50 p-3">
        <img
          src={url}
          alt={file.name}
          className="max-h-[70vh] max-w-full rounded-md"
        />
      </div>
    );
  }

  return (
    <div className="border-t border-foreground/10 p-3 text-sm text-muted-foreground">
      {t("ui.invoices.attachments.previewUnavailable")}
    </div>
  );
};
