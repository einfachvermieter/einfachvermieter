import { z } from "zod";

/**
 * Einwilligungen für die Internetzugriffe der App (alle Opt-in):
 * Klimafaktoren vom DWD, Prüfung auf neue Versionen, pseudonyme
 * Nutzungsstatistik. null = noch nicht entschieden.
 * `installationId` ist die zufällige Kennung, die mit der Statistik
 * übermittelt wird; null, solange noch nie gesendet wurde.
 */
export type InternetSettingsDto = {
  climateFactorsAutoFetch: boolean | null;
  updateCheckEnabled: boolean | null;
  telemetryEnabled: boolean | null;
  installationId: string | null;
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
