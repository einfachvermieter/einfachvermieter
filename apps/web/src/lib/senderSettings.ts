import type {
  SenderSettingsDto,
  SenderSettingsUpdateDto,
} from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type SenderSettings = SenderSettingsDto;
export type SenderSettingsUpdate = SenderSettingsUpdateDto;

/**
 * Noch nicht übernommene Logo-Änderung; wird erst beim Speichern committet.
 */
export type PendingLogo =
  | { kind: "replace"; file: File }
  | { kind: "delete" }
  | null;

export const senderSettingsQueryOptions = queryOptions({
  queryKey: ["settings", "sender"],
  queryFn: () => api.get<SenderSettings>("/settings/sender"),
});

export const updateSenderSettings = (dto: SenderSettingsUpdate) =>
  api.patch<SenderSettings>("/settings/sender", dto);

export const uploadSenderLogo = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.postFormData<SenderSettings>("/settings/sender/logo", formData);
};

export const deleteSenderLogo = () =>
  api.delete<SenderSettings>("/settings/sender/logo");

/**
 * PDF-Vorschau der noch nicht gespeicherten Datei (so, wie react-pdf sie
 * rendert)
 */
export const previewSenderLogoPdf = (file: File): Promise<Blob> => {
  const formData = new FormData();
  formData.append("file", file);
  return api.postFormDataBlob("/settings/sender/logo/preview", formData);
};

/**
 * URL zur PDF-Vorschau des aktuell gespeicherten Logos
 */
export const senderLogoPreviewUrl = (cacheBust: string): string =>
  `/api/settings/sender/logo/preview?v=${encodeURIComponent(cacheBust)}`;

/**
 * Liefert die URL zum aktuellen Logo
 */
export const senderLogoUrl = (cacheBust: string): string =>
  `/api/settings/sender/logo?v=${encodeURIComponent(cacheBust)}`;
