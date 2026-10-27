import type {
  ExternalHeatingEntry,
  ExternalHeatingEntryCreateDto,
  ExternalHeatingEntryUpdateDto,
  HeatingBaseMethod,
  HeatingSettings,
  HeatingSettingsWriteDto,
} from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import type { Building } from "./buildings";
import { t } from "./i18n";

export type {
  ExternalHeatingEntry,
  ExternalHeatingEntryCreateDto,
  ExternalHeatingEntryFormValues,
  ExternalHeatingEntryUpdateDto,
  HeatingBaseMethod,
  HeatingConsumptionMethod,
  HeatingMode,
  HeatingSettings,
  HeatingSettingsWriteDto,
} from "@einfachvermieter/shared";

export type HeatingSortColumn = "building" | "mode" | "validFrom";

export type HeatingOverviewRow = {
  building: Building;
  settings: HeatingSettings;
};

export type HeatingOverviewParams = {
  page: number;
  pageSize: number;
  sort?: HeatingSortColumn;
  order?: "asc" | "desc";
  q?: string;
  buildingId?: string;
};

export type HeatingOverviewResult = {
  items: HeatingOverviewRow[];
  total: number;
};

export const heatingOverviewQueryOptions = (params: HeatingOverviewParams) =>
  queryOptions({
    queryKey: ["heating", "page", params],
    queryFn: () => {
      const search = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      });
      if (params.sort) {
        search.set("sort", params.sort);
      }
      if (params.order) {
        search.set("order", params.order);
      }
      if (params.q) {
        search.set("q", params.q);
      }
      if (params.buildingId) {
        search.set("buildingId", params.buildingId);
      }
      return api.get<HeatingOverviewResult>(`/heating?${search.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

/**
 * Liste aller Versionen der Heizkosten-Konfiguration eines Gebäudes,
 * sortiert nach validFrom (neueste zuerst).
 */
export const heatingSettingsListQueryOptions = (buildingId: string) =>
  queryOptions({
    queryKey: ["heating", buildingId, "versions"],
    queryFn: () =>
      api.get<HeatingSettings[]>(`/buildings/${buildingId}/heating`),
  });

/**
 * Maßgebliche Version zum Stichtag: die heute gültige, in einer Lücke die
 * zuletzt gültige, erst ohne beide die künftige. `versions` absteigend nach
 * `validFrom`.
 */
export const currentHeatingVersion = (
  versions: readonly HeatingSettings[],
  today: string,
): HeatingSettings | undefined =>
  versions.find((version) => version.validFrom <= today) ?? versions[0];

/**
 * Grundkostenmaßstab der Version, die vor `validFrom` beginnt, sofern sie
 * intern abrechnet. Bei externer Abrechnung ist der gespeicherte Wert nur
 * ein Füllwert. `versions` absteigend nach `validFrom`.
 */
export const previousBaseMethodOf = (
  versions: HeatingSettings[],
  validFrom: string,
): HeatingBaseMethod | undefined => {
  const previous = versions.find((version) => version.validFrom < validFrom);

  return previous?.mode === "internal" ? previous.baseMethod : undefined;
};

export const heatingSettingsByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["heating", "version", id],
    queryFn: () => api.get<HeatingSettings>(`/heating/${id}`),
  });

/**
 * Identifizierende Bezeichnung einer Heizkosten-Konfiguration für
 * Überschrift, Breadcrumb und Tab-Titel: der Gültig-ab-Stichtag. Ohne das
 * Wort "Heizkosten". Der Typ steht bereits im Breadcrumb-Pfad.
 */
export const heatingIdentityLabel = (
  version: Pick<HeatingSettings, "validFrom">,
): string =>
  t("ui.heating.identityTitle", { validFrom: formatDate(version.validFrom) });

export const createHeatingSettings = (
  buildingId: string,
  dto: HeatingSettingsWriteDto,
) => api.post<HeatingSettings>(`/buildings/${buildingId}/heating`, dto);

export const updateHeatingSettings = (
  buildingId: string,
  id: string,
  dto: HeatingSettingsWriteDto,
) => api.patch<HeatingSettings>(`/buildings/${buildingId}/heating/${id}`, dto);

export const deleteHeatingSettings = (buildingId: string, id: string) =>
  api.delete(`/buildings/${buildingId}/heating/${id}`);

export const externalHeatingEntriesQueryOptions = (buildingId: string) =>
  queryOptions({
    queryKey: ["heating", buildingId, "external-entries"],
    queryFn: () =>
      api.get<ExternalHeatingEntry[]>(
        `/buildings/${buildingId}/heating/external-entries`,
      ),
  });

export const createExternalHeatingEntry = (
  buildingId: string,
  dto: ExternalHeatingEntryCreateDto,
) =>
  api.post<ExternalHeatingEntry>(
    `/buildings/${buildingId}/heating/external-entries`,
    dto,
  );

export const updateExternalHeatingEntry = (
  id: string,
  dto: ExternalHeatingEntryUpdateDto,
) => api.patch<ExternalHeatingEntry>(`/heating/external-entries/${id}`, dto);

export const deleteExternalHeatingEntry = (id: string) =>
  api.delete(`/heating/external-entries/${id}`);
