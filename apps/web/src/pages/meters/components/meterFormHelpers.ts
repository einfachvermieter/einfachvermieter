import {
  DEFAULT_RESET_DAY,
  type MeterFormValues,
  type MeterType,
  RESET_DAY_NONE,
  UNIT_NONE,
} from "@einfachvermieter/shared";
import type { Meter } from "../../../lib/meters";

export const emptyMeterFormValues = (
  buildingId: string,
  today: string,
  initialType: MeterType = "water_cold",
): MeterFormValues => ({
  buildingId,
  type: initialType,
  role: "unit",
  label: "",
  serialNumber: "",
  unitId: UNIT_NONE,
  room: "",
  gasFactors: [],
  radiator: "",
  kTotal: "",
  radiatorManufacturer: "",
  radiatorModel: "",
  radiatorType: "",
  radiatorDimensions: "",
  isRemoteReadable: false,
  validFrom: today,
  validUntil: "",
  resetDay:
    initialType === "heat_cost_allocator" ? DEFAULT_RESET_DAY : RESET_DAY_NONE,
  costAllocationMode: "cost_types",
  costTypeIds: [],
  baseMeterId: "",
  subtractedMeterIds: [],
});

export const meterToFormValues = (meter: Meter): MeterFormValues => ({
  buildingId: meter.buildingId,
  type: meter.type,
  role: meter.role,
  label: meter.label,
  serialNumber: meter.serialNumber ?? "",
  unitId: meter.unitId ?? UNIT_NONE,
  room: meter.room ?? "",
  gasFactors:
    meter.type === "gas"
      ? meter.gasFactors.map((factor) => ({
          id: factor.id,
          validFrom: factor.validFrom,
          validUntil: factor.validUntil ?? "",
          energyFactor:
            factor.energyFactorKwhPerM3 === null
              ? ""
              : String(factor.energyFactorKwhPerM3).replace(".", ","),
          notes: factor.notes ?? "",
        }))
      : [],
  radiator: meter.radiator ?? "",
  kTotal: meter.kTotal === null ? "" : String(meter.kTotal),
  radiatorManufacturer: meter.radiatorManufacturer ?? "",
  radiatorModel: meter.radiatorModel ?? "",
  radiatorType: meter.radiatorType ?? "",
  radiatorDimensions: meter.radiatorDimensions ?? "",
  isRemoteReadable: meter.isRemoteReadable,
  validFrom: meter.validFrom,
  validUntil: meter.validUntil ?? "",
  resetDay: meter.resetDay ?? RESET_DAY_NONE,
  costAllocationMode: meter.costAllocationMode,
  costTypeIds: meter.costTypeIds,
  baseMeterId: meter.differenceConfig?.baseMeterId ?? "",
  subtractedMeterIds: meter.differenceConfig?.subtractedMeterIds ?? [],
});
