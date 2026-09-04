import type { Meter } from "../../lib/meters";

/**
 * Zähler, die als Wärmemengenzähler am Warmwasserboiler in Frage kommen:
 * gebäudezentrale WMZ, die Teil der Heizkostenabrechnung sind.
 */
export const hotWaterMeterCandidatesOf = (meters: Meter[]): Meter[] =>
  meters.filter(
    (meter) =>
      meter.type === "heat_meter" &&
      meter.unitId === null &&
      meter.role !== "unit" &&
      meter.role !== "virtual_difference" &&
      meter.costAllocationMode === "heating_cost_bill",
  );
