import { z } from "zod";

/**
 * Einwilligungen für die Internetzugriffe der App (alle Opt-in):
 * Klimafaktoren vom DWD, Prüfung auf neue Versionen, anonyme
 * Nutzungsstatistik. null = noch nicht entschieden
 */
export type InternetSettingsDto = {
  climateFactorsAutoFetch: boolean | null;
  updateCheckEnabled: boolean | null;
  telemetryEnabled: boolean | null;
};

/**
 * Teil-Update: nur die übergebenen Entscheidungen werden gesetzt.
 */
export const internetSettingsUpdateSchema = z
  .object({
    climateFactorsAutoFetch: z.boolean().optional(),
    updateCheckEnabled: z.boolean().optional(),
    telemetryEnabled: z.boolean().optional(),
  })
  .strict();
export type InternetSettingsUpdateDto = z.infer<
  typeof internetSettingsUpdateSchema
>;
