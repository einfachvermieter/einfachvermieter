import { formatBytes } from "@einfachvermieter/shared";
import {
  RiDeleteBinLine,
  RiFileLine,
  RiFilePdf2Line,
  RiImageLine,
} from "@remixicon/react";
import { useState } from "react";
import { FileDropZone } from "@/components/common/FileDropZone";
import { Button } from "@/components/ui/Button";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ATTACHMENT_ACCEPT_ATTR,
  MAX_ATTACHMENT_BYTES,
} from "../../../../lib/attachments";
import { t } from "../../../../lib/i18n";

const fileIcon = (file: File) => {
  if (file.type === "application/pdf") {
    return (
      <RiFilePdf2Line className="size-5 text-himbeere-500" aria-hidden={true} />
    );
  }
  if (file.type.startsWith("image/")) {
    return <RiImageLine className="size-5 text-azur-700" aria-hidden={true} />;
  }
  return (
    <RiFileLine className="size-5 text-muted-foreground" aria-hidden={true} />
  );
};

const isAllowed = (file: File): boolean =>
  (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type);

/**
 * Belege, die erst nach dem Anlegen der Rechnung hochgeladen werden
 */
export const PendingAttachments = ({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onFilesSelected = (selected: FileList) => {
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
  };

  return (
    <div className="flex flex-col gap-4">
      <FileDropZone
        accept={ATTACHMENT_ACCEPT_ATTR}
        buttonLabel={t("ui.invoices.attachments.upload")}
        disabled={disabled}
        hint={
          <>
            <span className="block">
              {t("ui.invoices.attachments.dropHint")}
            </span>
            <span className="block text-xs">
              {t("ui.invoices.attachments.hintDeferred", {
                limit: formatBytes(MAX_ATTACHMENT_BYTES),
              })}
            </span>
          </>
        }
        onFiles={onFilesSelected}
      />

      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      {files.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {files.map((file, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: ausstehende Dateien haben keine Id
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 px-3 py-2"
            >
              {fileIcon(file)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatBytes(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghostDestructive"
                size="icon-sm"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={t("ui.invoices.attachments.delete")}
              >
                <RiDeleteBinLine aria-hidden={true} />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
