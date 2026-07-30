import { describe, expect, it } from "vitest";
import { formatBemessung } from "./costsDisplay.js";

/**
 * Übersetzungs-Stub: nur der Plural-Pfad (Personen) ruft ihn auf.
 */
const translate = (key: string, params?: Record<string, unknown>): string =>
  `${key}#${params?.count}`;

describe("formatBemessung", () => {
  it("gibt Flächen/Volumen mit zwei Nachkommastellen und Einheit aus", () => {
    expect(formatBemessung(12, "m²", translate)).toBe("12,00\u00A0m²");
    expect(formatBemessung(3.5, "m³", translate)).toBe("3,50\u00A0m³");
  });

  it("kürzt Personentage zu PT ohne Nachkommastellen", () => {
    expect(formatBemessung(5, "Personentage", translate)).toBe("5\u00A0PT");
  });

  it("übersetzt pluralabhängige Einheiten über die Renderer-Funktion", () => {
    expect(formatBemessung(3, "person", translate)).toBe(
      "3\u00A0costs.units.person#3",
    );
    expect(formatBemessung(1, "unit", translate)).toBe(
      "1\u00A0costs.units.unit#1",
    );
  });

  it("gibt ohne Einheit nur die Zahl aus", () => {
    expect(formatBemessung(7, null, translate)).toBe("7");
    expect(formatBemessung(7, undefined, translate)).toBe("7");
  });
});
