import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
} from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_BYTES };

export type CostEntryAttachment = {
  id: string;
  costEntryId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export const ATTACHMENT_ACCEPT_ATTR = ALLOWED_ATTACHMENT_MIME_TYPES.join(",");

export const isPdfAttachment = (att: CostEntryAttachment): boolean =>
  att.mimeType === "application/pdf";

export const isImageAttachment = (att: CostEntryAttachment): boolean =>
  att.mimeType.startsWith("image/");

export const attachmentFileUrl = (
  costEntryId: string,
  attachmentId: string,
): string => `/api/costs/${costEntryId}/attachments/${attachmentId}`;

export const costEntryAttachmentsQueryOptions = (costEntryId: string) =>
  queryOptions({
    queryKey: ["costEntry", costEntryId, "attachments"],
    queryFn: () =>
      api.get<CostEntryAttachment[]>(`/costs/${costEntryId}/attachments`),
  });

export const uploadCostEntryAttachment = (
  costEntryId: string,
  file: File,
  options?: { ocrText?: string },
): Promise<CostEntryAttachment> => {
  const formData = new FormData();

  formData.append("file", file);
  if (options?.ocrText) {
    formData.append("ocrText", options.ocrText);
  }

  return api.postFormData<CostEntryAttachment>(
    `/costs/${costEntryId}/attachments`,
    formData,
  );
};

export const deleteCostEntryAttachment = (
  costEntryId: string,
  attachmentId: string,
): Promise<{ id: string }> =>
  api.delete<{ id: string }>(
    `/costs/${costEntryId}/attachments/${attachmentId}`,
  );
