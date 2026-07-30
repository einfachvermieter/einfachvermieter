/**
 * Gemeinsame Anzeige-Formatierung der Betriebskosten-Tabelle in Web und PDF
 * Gleiche Daten, Markup jeweils getrennt
 */

import { formatNumber } from "../format.js";

/**
 * Nachkommastellen je Bemessungs-Einheit: Flächen/Volumen 2, Zähl-Einheiten 0
 */
export const bemessungDigits = (unit: string | null | undefined): number =>
  unit === "m²" || unit === "m³" ? 2 : 0;

const PLURAL_BEMESSUNG_UNITS = new Set(["person", "unit"]);

/**
 * "Personentage" als Label ist zu lang
 */
const shortBemessungUnit = (unit: string): string =>
  unit === "Personentage" ? "PT" : unit;

/**
 * Bemessungswert mit Einheit ("12,00 m²", "5 Personen"). Der Renderer reicht
 * seine eigene `t`-Funktion herein, damit pluralabhängige Einheiten (Personen)
 * lokalisiert werden; alle übrigen Einheiten sind feste Kürzel.
 */
export const formatBemessung = (
  value: number,
  unit: string | null | undefined,
  translate: (key: string, params?: Record<string, unknown>) => string,
): string => {
  const digits = bemessungDigits(unit);
  if (!unit) {
    return formatNumber(value, digits);
  }

  const unitText = PLURAL_BEMESSUNG_UNITS.has(unit)
    ? translate(`costs.units.${unit}`, { count: value })
    : shortBemessungUnit(unit);
  return `${formatNumber(value, digits)}\u00A0${unitText}`;
};
