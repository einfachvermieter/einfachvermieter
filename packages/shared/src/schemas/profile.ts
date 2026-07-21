import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";

/**
 * Eingabe zum Ändern des eigenen Namens (Einstellungen -> Profil). Nur im
 * `session`-Auth-Modus relevant; die Desktop-App hat kein Konto.
 */
export const profileUpdateSchema = z.object({
  firstName: z
    .string()
    .min(1, messageKey("validation.required"))
    .max(100, messageKey("validation.tooLong", { max: 100 })),
  lastName: z
    .string()
    .min(1, messageKey("validation.required"))
    .max(100, messageKey("validation.tooLong", { max: 100 })),
});

export type ProfileUpdateDto = z.infer<typeof profileUpdateSchema>;
