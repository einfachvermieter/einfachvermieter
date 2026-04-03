import { z } from "zod";

/**
 * Zentrale Date-/Validierungsbausteine. Einzige Stelle, an der die
 * kanonischen Regexes für ISO-Datum (`YYYY-MM-DD`) leben.
 */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/u;

export const isoDate = () =>
  z.string().regex(ISO_DATE_REGEX, "Datum im Format YYYY-MM-DD erwartet");

export const allocationKeys = [
  "per_living_area",
  "per_heating_area",
  "per_person",
  "per_unit",
  "per_consumption_m3",
  "per_consumption_kwh",
  "heating_ordinance",
  "fixed",
] as const;

export type AllocationKey = (typeof allocationKeys)[number];

/**
 * Umlageschlüssel, die an einer Kostenart wählbar sind.
 * (Heizkosten haben `category = "heating"` statt eines
 * Umlageschlüssels)
 */
export const costTypeAllocationKeys = [
  "per_living_area",
  "per_heating_area",
  "per_person",
  "per_unit",
  "per_consumption_m3",
  "fixed",
] as const;

export type CostTypeAllocationKey = (typeof costTypeAllocationKeys)[number];

/**
 * Kategorien einer Kostenart. Trennt Betriebskosten (eigene Verteilung pro
 * Kostenart) von Heizkosten (laufen gesammelt über die Heizkostenkonfiguration
 * des Gebäudes).
 */
export const costTypeCategories = ["operating", "heating"] as const;
export type CostTypeCategory = (typeof costTypeCategories)[number];

/**
 * Kategorien der steuerlichen Begünstigung nach § 35a EStG. Steuert, ob und
 * unter welcher Höchstgrenze ein Mieter den Lohnanteil einer Rechnungsposition
 * in seiner Steuererklärung absetzen kann:
 *
 * - "craftsman":         Handwerkerleistungen
 * - "household_service": Haushaltsnahe Dienstleistungen
 */
export const laborCostCategories = ["craftsman", "household_service"] as const;
export type LaborCostCategory = (typeof laborCostCategories)[number];

/**
 * Messgrößen / Verbrauchseinheiten. Einzige Stelle, die physische Einheiten
 * aufzählt. Wird an Zählern verwendet (welche Einheit liefert der Zähler?).
 */
export const measurementUnits = ["m3", "kwh", "units"] as const;
export type MeasurementUnit = (typeof measurementUnits)[number];
