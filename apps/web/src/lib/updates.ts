import type {
  InternetSettingsDto,
  InternetSettingsUpdateDto,
  UpdateStatus,
} from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Einwilligungen für Internetzugriffe (DWD, Versionsprüfung,
 * Nutzungsstatistik).
 */
export const internetSettingsQueryOptions = queryOptions({
  queryKey: ["internetSettings"],
  queryFn: () => api.get<InternetSettingsDto>("/settings/internet"),
});

export const updateInternetSettings = (patch: InternetSettingsUpdateDto) =>
  api.patch<InternetSettingsDto>("/settings/internet", patch);

/**
 * Versionsstand (installiert vs. neueste bekannte Version). Die API cacht
 * den Abruf der Versionsdatei einen Tag
 */
export const updateStatusQueryOptions = queryOptions({
  queryKey: ["updateStatus"],
  queryFn: () => api.get<UpdateStatus>("/updates"),
  staleTime: 60 * 60 * 1000,
});
