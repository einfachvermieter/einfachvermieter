import { z } from "zod";
import { isoDate } from "./common.js";
import { substitutionScopes } from "./consumption-substitutions.js";

/**
 * Zeitraum, in dem eine Wohnung technisch nicht aus der zentralen Anlage
 * versorgt wird, getrennt für Heizung und Warmwasser. Ohne Eintrag nimmt
 * die Wohnung teil. Leerstand, zugedrehte oder entfernte Heizkörper sind
 * keine Nichtteilnahme.
 */
export type UnitSupplyExclusion = {
  id: string;
  unitId: string;
  scope: (typeof substitutionScopes)[number];
  /**
   * Erster Tag ohne Versorgung aus der zentralen Anlage
   */
  validFrom: string;
  /**
   * Letzter Tag ohne Versorgung; null = bis auf Weiteres
   */
  validUntil: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const unitSupplyExclusionWriteSchema = z
  .object({
    scope: z.enum(substitutionScopes),
    validFrom: isoDate(),
    validUntil: isoDate().nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .strict()
  .refine(
    (value) => value.validUntil === null || value.validUntil >= value.validFrom,
    { path: ["validUntil"], message: "validUntil vor validFrom" },
  );

export type UnitSupplyExclusionWriteDto = z.infer<
  typeof unitSupplyExclusionWriteSchema
>;
