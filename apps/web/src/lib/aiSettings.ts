import type {
  AiSettingsDto,
  AiSettingsUpdateDto,
} from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type AiSettings = AiSettingsDto;
export type AiSettingsUpdate = AiSettingsUpdateDto;

/**
 * Wert im Anbieter-Auswahlfeld, der die KI-Extraktion abschaltet. Ein leerer
 * String ist als Select-Wert nicht zulässig, deshalb dieses Kennwort.
 */
export const AI_PROVIDER_NONE = "none";

export const aiSettingsQueryOptions = queryOptions({
  queryKey: ["settings", "ai"],
  queryFn: () => api.get<AiSettings>("/settings/ai"),
});

export const updateAiSettings = (dto: AiSettingsUpdate) =>
  api.patch<AiSettings>("/settings/ai", dto);
