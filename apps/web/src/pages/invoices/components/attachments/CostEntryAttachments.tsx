import { formatBytes, formatDate } from "@einfachvermieter/shared";
import {
  RiAttachment2,
  RiBardFill,
  RiDeleteBinLine,
  RiEyeLine,
  RiFileLine,
  RiFilePdf2Line,
  RiImageLine,
  RiLoader4Line,
} from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileDropZone } from "@/components/common/FileDropZone";
import { SectionCard } from "@/components/common/SectionCard";
import { DestructiveConfirmDialog } from "@/components/DestructiveConfirmDialog";
import { Button } from "@/components/ui/Button";
import { isMistralSupported } from "../../../../lib/aiExtraction";
import { ApiError } from "../../../../lib/api";
import {
  ATTACHMENT_ACCEPT_ATTR,
  attachmentFileUrl,
  type CostEntryAttachment,
  costEntryAttachmentsQueryOptions,
  deleteCostEntryAttachment,
  isImageAttachment,
  isPdfAttachment,
  MAX_ATTACHMENT_BYTES,
  uploadCostEntryAttachment,
} from "../../../../lib/attachments";
import { t } from "../../../../lib/i18n";

/**
 * Getönte 36-px-Kachel nach Dateityp: PDF himbeere, Bild azur,
 * sonst schiefer.
 */
const AttachmentTile = ({ att }: { att: CostEntryAttachment }) => {
  if (isPdfAttachment(att)) {
    return (
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-himbeere-50 text-himbeere-500">
        <RiFilePdf2Line className="size-4.5" aria-hidden={true} />
      </div>
    );
  }
  if (isImageAttachment(att)) {
    return (
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-azur-50 text-azur-700">
        <RiImageLine className="size-4.5" aria-hidden={true} />
      </div>
    );
  }
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
      <RiFileLine className="size-4.5" aria-hidden={true} />
    </div>
  );
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge liegt am Markup
export const CostEntryAttachments = ({
  costEntryId,
  onExtract,
  onUploaded,
  extractingAttachmentId,
}: {
  costEntryId: string;
  onExtract?: (attachmentId: string) => void;
  /**
   * Meldet einen frisch hochgeladenen Beleg an die Rechnungs-Seite
   */
  onUploaded?: (attachment: CostEntryAttachment) => void;
  extractingAttachmentId?: string | null;
}) => {
  const queryClient = useQueryClient();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<CostEntryAttachment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const attachmentsQuery = useQuery(
    costEntryAttachmentsQueryOptions(costEntryId),
  );

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["costEntry", costEntryId, "attachments"],
    });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCostEntryAttachment(costEntryId, file),
    onSuccess: async (created) => {
      setErrorMessage(null);
      await invalidate();
      toast.success(t("common.saved"));
      onUploaded?.(created);
    },
    onError: (err: unknown) => {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : t("ui.invoices.attachments.uploadFailed"),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (att: CostEntryAttachment) =>
      deleteCostEntryAttachment(costEntryId, att.id),
    onSuccess: async (_data, variables) => {
      setErrorMessage(null);
      if (previewId === variables.id) {
        setPreviewId(null);
      }
      setPendingDelete(null);
      await invalidate();
      toast.success(t("common.deleted"));
    },
    onError: (err: unknown) => {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : t("ui.invoices.attachments.deleteFailed"),
      );
    },
  });

  const onFilesSelected = (files: FileList) => {
    setErrorMessage(null);
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setErrorMessage(
          t("ui.invoices.attachments.tooLarge", {
            filename: file.name,
            limit: formatBytes(MAX_ATTACHMENT_BYTES),
          }),
        );
        continue;
      }
      uploadMutation.mutate(file);
    }
  };

  const attachments = attachmentsQuery.data ?? [];

  return (
    <SectionCard
      icon={RiAttachment2}
      title={t("ui.invoices.attachments.title")}
    >
      <div className="space-y-4">
        <FileDropZone
          accept={ATTACHMENT_ACCEPT_ATTR}
          buttonLabel={
            uploadMutation.isPending
              ? t("ui.invoices.attachments.uploading")
              : t("ui.invoices.attachments.upload")
          }
          disabled={uploadMutation.isPending}
          hint={
            <>
              <span className="block">
                {t("ui.invoices.attachments.dropHint")}
              </span>
              <span className="block text-xs">
                {t("ui.invoices.attachments.hint", {
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

        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("ui.invoices.attachments.empty")}
          </p>
        ) : (
          <ul>
            {attachments.map((att) => {
              const isOpen = previewId === att.id;
              return (
                <li
                  key={att.id}
                  className="flex flex-col border-t border-border first:border-t-0"
                >
                  <div className="flex items-center gap-3 py-3">
                    <AttachmentTile att={att} />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setPreviewId(isOpen ? null : att.id)}
                        className="block w-full truncate text-left text-sm font-semibold hover:underline"
                        title={att.originalFilename}
                      >
                        {att.originalFilename}
                      </button>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t("ui.invoices.attachments.fileMeta", {
                          size: formatBytes(att.sizeBytes),
                          date: formatDate(att.createdAt.slice(0, 10)),
                        })}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {onExtract && isMistralSupported(att.mimeType) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onExtract(att.id)}
                          disabled={Boolean(extractingAttachmentId)}
                        >
                          {extractingAttachmentId === att.id ? (
                            <RiLoader4Line
                              aria-hidden={true}
                              className="animate-spin"
                            />
                          ) : (
                            <RiBardFill aria-hidden={true} />
                          )}
                          {extractingAttachmentId === att.id
                            ? t("ui.invoices.aiExtract.extracting")
                            : t("ui.invoices.aiExtract.button")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewId(isOpen ? null : att.id)}
                        aria-label={t("ui.invoices.attachments.preview")}
                      >
                        <RiEyeLine aria-hidden={true} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete(att)}
                        disabled={
                          deleteMutation.isPending &&
                          deleteMutation.variables?.id === att.id
                        }
                        aria-label={t("ui.invoices.attachments.delete")}
                      >
                        <RiDeleteBinLine
                          aria-hidden={true}
                          className="text-destructive"
                        />
                      </Button>
                    </div>
                  </div>
                  {isOpen ? (
                    <AttachmentPreview
                      costEntryId={costEntryId}
                      attachment={att}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DestructiveConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        title={t("ui.invoices.attachments.confirmDelete")}
        description={
          pendingDelete
            ? t("ui.invoices.attachments.confirmDeleteMessage", {
                filename: pendingDelete.originalFilename,
              })
            : undefined
        }
        confirmLabel={t("ui.common.action.delete")}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete);
          }
        }}
      />
    </SectionCard>
  );
};

const AttachmentPreview = ({
  costEntryId,
  attachment,
}: {
  costEntryId: string;
  attachment: CostEntryAttachment;
}) => {
  const url = attachmentFileUrl(costEntryId, attachment.id);

  if (isPdfAttachment(attachment)) {
    return (
      <div className="border-t border-foreground/10 bg-muted p-3">
        <iframe
          src={url}
          title={attachment.originalFilename}
          className="h-[70vh] w-full rounded-md border border-foreground/10 bg-white"
        />
      </div>
    );
  }

  if (isImageAttachment(attachment)) {
    return (
      <div className="flex justify-center border-t border-foreground/10 bg-muted p-3">
        <img
          src={url}
          alt={attachment.originalFilename}
          className="max-h-[70vh] max-w-full rounded-md"
        />
      </div>
    );
  }

  return (
    <div className="border-t border-foreground/10 p-3 text-sm text-muted-foreground">
      {t("ui.invoices.attachments.previewUnavailable")}{" "}
      <a
        href={url}
        className="underline"
        download={attachment.originalFilename}
      >
        {t("ui.invoices.attachments.download")}
      </a>
    </div>
  );
};
