import type {
  CostAllocationMode,
  MeasurementUnit,
  MeterReadBy,
  MeterRole,
  MeterType,
} from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import { t } from "./i18n";

export type {
  CostAllocationMode,
  MeasurementUnit,
  MeterReadBy,
  MeterRole,
  MeterType,
};

export type GasFactor = {
  id: string;
  meterId: string;
  validFrom: string;
  validUntil: string | null;
  energyFactorKwhPerM3: number | null;
  notes: string | null;
};

export type MeterDifferenceConfig = {
  baseMeterId: string;
  subtractedMeterIds: string[];
};

export type Meter = {
  id: string;
  buildingId: string;
  unitId: string | null;
  type: MeterType;
  role: MeterRole;
  label: string;
  serialNumber: string | null;
  measurementUnit: MeasurementUnit;
  room: string | null;
  gasFactors: GasFactor[];
  radiator: string | null;
  kTotal: number | null;
  radiatorManufacturer: string | null;
  radiatorModel: string | null;
  radiatorType: string | null;
  radiatorDimensions: string | null;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  costAllocationMode: CostAllocationMode;
  costAllocationModeLocked: boolean;
  costTypeIds: string[];
  differenceConfig: MeterDifferenceConfig | null;
};

export type Reading = {
  id: string;
  meterId: string;
  readingDate: string;
  value: number;
  isEstimated: boolean;
  readBy: MeterReadBy;
  notes: string | null;
};

export const meterReadByLabel = (readBy: MeterReadBy): string =>
  t(`ui.reading.readBy.${readBy}`);

export type MeterSortColumn = "label" | "type" | "role";

export type MetersOverviewParams = {
  page: number;
  pageSize: number;
  sort?: MeterSortColumn;
  order?: "asc" | "desc";
  q?: string;
  buildingId?: string;
};

export type MetersOverviewResult = {
  items: Meter[];
  total: number;
};

export const meterTypeLabel = (type: MeterType): string =>
  t(`meters.types.${type}`);

export const meterRoleLabel = (role: MeterRole): string =>
  t(`meters.roles.${role}`);

export const measurementUnitLabel = (unit: MeasurementUnit): string =>
  t(`meters.measurementUnits.${unit}`);

export const meterQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["meter", id],
    queryFn: () => api.get<Meter>(`/meters/${id}`),
  });

export const metersOverviewQueryOptions = (params: MetersOverviewParams) =>
  queryOptions({
    queryKey: ["meters", "page", params],
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

      return api.get<MetersOverviewResult>(`/meters?${search.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

export const readingsQueryOptions = (meterId: string) =>
  queryOptions({
    queryKey: ["readings", meterId],
    queryFn: () => api.get<Reading[]>(`/meters/${meterId}/readings`),
  });
