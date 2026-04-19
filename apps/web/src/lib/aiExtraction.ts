import type {
  AiConfig,
  CostEntryExtractionResult,
} from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export const aiConfigQueryOptions = queryOptions({
  queryKey: ["ai", "config"],
  queryFn: () => api.get<AiConfig>("/ai/config"),
  staleTime: 5 * 60 * 1000,
});

export const extractCostEntryFromFile = (
  file: File,
  buildingId?: string,
): Promise<CostEntryExtractionResult> => {
  const formData = new FormData();

  formData.append("file", file);
  if (buildingId) {
    formData.append("buildingId", buildingId);
  }

  return api.postFormData<CostEntryExtractionResult>(
    "/ai/extract-cost-entry/upload",
    formData,
  );
};

export const extractCostEntryFromAttachment = (input: {
  costEntryId: string;
  attachmentId: string;
  buildingId?: string;
}): Promise<CostEntryExtractionResult> =>
  api.post<CostEntryExtractionResult>(
    "/ai/extract-cost-entry/from-attachment",
    input,
  );

export const MISTRAL_SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const isMistralSupported = (mimeType: string): boolean =>
  (MISTRAL_SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
