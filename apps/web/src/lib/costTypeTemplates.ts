import {
  type HeatingMode,
  type HeatingSettings,
  isCo2SplitInapplicableFuel,
  normalizeCostTypeName,
} from "@einfachvermieter/shared";
import type { CostType } from "./costs";
import { currentHeatingVersion } from "./heating";
import type { Meter } from "./meters";

/**
 * True, wenn eine Wohnung des Gebäudes einen aktiven Wasserzähler hat, auch
 * als Differenzzähler. Ein Hauptzähler allein erfasst keinen Verbrauch je
 * Wohnung.
 */
export const hasUnitWaterMeters = (meters: readonly Meter[]): boolean =>
  meters.some(
    (meter) =>
      meter.isActive &&
      meter.unitId !== null &&
      (meter.type === "water_cold" || meter.type === "water_hot"),
  );

/**
 * True, wenn eine Heizkostenkonfiguration die CO2-Aufteilung mit einem
 * CO2-pflichtigen Brennstoff nutzt. Externe Versionen und solche ohne
 * Heizkostenabrechnung tragen die CO2-Felder nur als Füllwert.
 */
export const usesCo2Split = (configs: readonly HeatingSettings[]): boolean =>
  configs.some(
    (config) =>
      config.mode === "internal" &&
      config.co2CostShareEnabled &&
      !isCo2SplitInapplicableFuel(config.fuelType),
  );

/**
 * Normalisierte Namen der Kostenarten eines Gebäudes, gegen die eine
 * Vorlage als "bereits vorhanden" gilt
 */
export const existingCostTypeNames = (
  costTypes: readonly CostType[],
  buildingId: string,
): Set<string> =>
  new Set(
    costTypes
      .filter((costType) => costType.buildingId === buildingId)
      .map((costType) => normalizeCostTypeName(costType.name)),
  );

/**
 * Modus der maßgeblichen Heizkostenkonfiguration, über den das Sheet bei
 * externer oder keiner Heizkostenabrechnung einen Hinweis zeigt
 */
export const heatingNoticeMode = (
  versions: readonly HeatingSettings[],
  today: string,
): Exclude<HeatingMode, "internal"> | null => {
  const mode = currentHeatingVersion(versions, today)?.mode;
  return mode === "external" || mode === "none" ? mode : null;
};
