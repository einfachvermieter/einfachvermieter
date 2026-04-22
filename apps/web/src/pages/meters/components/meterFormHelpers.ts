import {
  type MeterFormValues,
  type MeterType,
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
  validFrom: today,
  validUntil: "",
  costAllocationMode: "cost_types",
  costTypeIds: [],
  baseMeterId: "",
  subtractedMeterIds: [],
});

export const meterToFormValues = (meter: Meter): MeterFormValues => ({
  buildingId: meter.buildingId,
  type: meter.type,
  role: meter.role,
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
              : String(factor.energyFactorKwhPerM3),
          notes: factor.notes ?? "",
        }))
      : [],
  radiator: meter.radiator ?? "",
  kTotal: meter.kTotal === null ? "" : String(meter.kTotal),
  radiatorManufacturer: meter.radiatorManufacturer ?? "",
  radiatorModel: meter.radiatorModel ?? "",
  radiatorType: meter.radiatorType ?? "",
  radiatorDimensions: meter.radiatorDimensions ?? "",
  validFrom: meter.validFrom,
  validUntil: meter.validUntil ?? "",
  costAllocationMode: meter.costAllocationMode,
  costTypeIds: meter.costTypeIds,
  baseMeterId: meter.differenceConfig?.baseMeterId ?? "",
  subtractedMeterIds: meter.differenceConfig?.subtractedMeterIds ?? [],
});
