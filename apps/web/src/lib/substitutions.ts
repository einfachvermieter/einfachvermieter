import {
  type CalcWarning,
  type ConsumptionSubstitution,
  type ConsumptionSubstitutionWriteDto,
  formatNumber,
  type Period,
  type ResolvedSubstitution,
  type SubstitutionScope,
} from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import { t } from "./i18n";

export type SubstitutionOptions = {
  meters: Array<{
    id: string;
    label: string;
    isContinuous: boolean;
    hasGap: boolean;
  }>;
  unitMeterCount: number;
  allMeters: Array<{ id: string; label: string; isActive: boolean }>;
  wholeUnitAreaSqm: number;
  shareMethod: boolean;
  referenceYears: Array<{ years: number; period: Period; isUsable: boolean }>;
  comparisonUnits: Array<{ id: string; name: string; isUsable: boolean }>;
};

export type SubstitutionPreview = {
  resolved: ResolvedSubstitution | null;
  warnings: Array<{ code: string; params?: Record<string, string | number> }>;
  affectedAreaSqm: number;
  totalAreaSqm: number;
  limitExceeded: boolean;
};

const basePath = (buildingId: string) =>
  `/buildings/${buildingId}/consumption-substitutions`;

export const substitutionsQueryOptions = (buildingId: string, period: Period) =>
  queryOptions({
    queryKey: ["substitutions", buildingId, period.start, period.end],
    queryFn: () =>
      api.get<ConsumptionSubstitution[]>(basePath(buildingId), {
        periodStart: period.start,
        periodEnd: period.end,
      }),
  });

export const substitutionOptionsQueryOptions = (
  buildingId: string,
  params: {
    unitId: string;
    scope: SubstitutionScope;
    period: Period;
    meterIds: string[];
  },
) =>
  queryOptions({
    queryKey: ["substitutions", buildingId, "options", params],
    queryFn: () =>
      api.get<SubstitutionOptions>(`${basePath(buildingId)}/options`, {
        unitId: params.unitId,
        scope: params.scope,
        periodStart: params.period.start,
        periodEnd: params.period.end,
        meterIds: params.meterIds.join(","),
      }),
    enabled: params.unitId !== "",
    // Beim Umschalten von Zählern derselben Wohnung die bisherigen Optionen
    // stehen lassen, sonst leeren sich Auswahlfelder kurz. Bei einer anderen
    // Wohnung oder einem anderen Bereich nicht, deren Zähler sind andere.
    placeholderData: (previous, previousQuery) => {
      const previousParams = previousQuery?.queryKey[3] as
        | typeof params
        | undefined;
      return previousParams?.unitId === params.unitId &&
        previousParams?.scope === params.scope
        ? previous
        : undefined;
    },
  });

export const substitutionPreviewQueryOptions = (
  buildingId: string,
  dto: ConsumptionSubstitutionWriteDto | null,
  existingId: string | null,
) =>
  queryOptions({
    queryKey: ["substitutions", buildingId, "preview", existingId, dto],
    queryFn: () =>
      api.post<SubstitutionPreview>(`${basePath(buildingId)}/preview`, {
        existingId,
        substitution: dto,
      }),
    enabled: dto !== null,
    retry: false,
  });

export const createSubstitution = (
  buildingId: string,
  dto: ConsumptionSubstitutionWriteDto,
) => api.post<ConsumptionSubstitution>(basePath(buildingId), dto);

export const updateSubstitution = (
  id: string,
  dto: ConsumptionSubstitutionWriteDto,
) =>
  api.patch<ConsumptionSubstitution>(`/consumption-substitutions/${id}`, dto);

export const deleteSubstitution = (id: string) =>
  api.delete(`/consumption-substitutions/${id}`);

/**
 * Menge in der Einheit des Bereichs: HKV-Einheiten, kWh oder m3
 */
export const formatSubstituteConsumption = (
  value: number,
  scope: SubstitutionScope,
  isAllocator: boolean,
): string => {
  if (scope === "hot_water") {
    return t("ui.substitutions.consumption.m3", {
      value: formatNumber(value, 2),
    });
  }

  return isAllocator
    ? t("ui.substitutions.consumption.hkv", { value: formatNumber(value, 0) })
    : t("ui.substitutions.consumption.kwh", { value: formatNumber(value, 0) });
};

/**
 * Rechenweg der Vorschau in einem Satz
 */
export const substitutionPreviewText = (
  preview: SubstitutionPreview,
  format: (value: number) => string,
): string | null => {
  const { resolved } = preview;
  if (!resolved) {
    return null;
  }
  const value = format(resolved.substituteConsumption);
  const { basis } = resolved;

  if (basis.referenceShare !== undefined) {
    return t("ui.substitutions.preview.share", {
      share: formatNumber(basis.referenceShare * 100, 2),
      value,
    });
  }
  if (basis.ratePerSqm !== undefined) {
    return t("ui.substitutions.preview.rate", {
      rate: format(basis.ratePerSqm),
      area: t("ui.common.measures.sqm", {
        value: formatNumber(resolved.affectedAreaSqm, 2),
      }),
      value,
    });
  }

  return t("ui.substitutions.preview.absolute", {
    reference: format(basis.referenceAffectedConsumption ?? 0),
    value,
  });
};

export type SubstitutionGap = {
  key: string;
  unitId: string;
  unit: string;
  meterId: string;
  meter: string;
  date: string;
  scope: SubstitutionScope;
};

/**
 * Offene Messdatenlücken aus den Warnungen der Berechnung
 */
export const substitutionGapsOf = (
  warnings: CalcWarning[] | undefined,
): SubstitutionGap[] =>
  (warnings ?? [])
    .filter((warning) => warning.code === "consumptionGap")
    .map((warning) => {
      const params = warning.params ?? {};
      return {
        key: `${params.meterId}|${params.date}`,
        unitId: String(params.unitId ?? ""),
        unit: String(params.unit ?? ""),
        meterId: String(params.meterId ?? ""),
        meter: String(params.label ?? ""),
        date: String(params.date ?? ""),
        scope: params.scope === "hot_water" ? "hot_water" : "heating",
      };
    });
