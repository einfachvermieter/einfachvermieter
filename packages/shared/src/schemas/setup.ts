import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { buildingCreateSchema } from "./buildings.js";
import { type PasswordPolicy, passwordSchema } from "./password.js";

/**
 * Antwort von `GET /api/setup/status`. `authMode` steuert im Frontend, ob
 * Login/Abmelden/Passwort sichtbar sind und ob der Assistent den
 * Admin-Konto-Schritt zeigt (`local` = Desktop-App ohne Login).
 */
export type SetupStatus = {
  needsSetup: boolean;
  authMode: "session" | "local";
};

/**
 * Eingabe des Erststart-Assistenten. Schritt 1 (Admin-Konto) ist Pflicht,
 * außer im `local`-Auth-Modus (`requireAdmin: false`, die Desktop-App hat
 * keinen Login); Absender und erstes Gebäude sind überspringbar. Der
 * Endpoint ist serverseitig hart gesperrt, sobald die Einrichtung erledigt
 * ist. Das Admin-Passwort wird gegen die (per ENV konfigurierbare) Policy
 * geprüft.
 */
export const makeSetupSchema = (
  policy: PasswordPolicy,
  options?: { requireAdmin?: boolean },
) =>
  z.object({
    admin: z
      .object({
        email: z.string().email(messageKey("ui.setup.validation.emailFormat")),
        password: passwordSchema(policy),
      })
      .optional()
      .refine(
        (admin) => admin !== undefined || options?.requireAdmin === false,
        {
          message: messageKey("validation.required"),
        },
      ),
    sender: z
      .object({
        senderName: z
          .string()
          .max(200, messageKey("validation.tooLong", { max: 200 })),
        senderAddressStreet: z
          .string()
          .max(200, messageKey("validation.tooLong", { max: 200 })),
        senderAddressPostalCode: z
          .string()
          .max(20, messageKey("validation.tooLong", { max: 20 })),
        senderAddressCity: z
          .string()
          .max(100, messageKey("validation.tooLong", { max: 100 })),
      })
      .optional(),
    building: buildingCreateSchema.optional(),
  });

export type SetupDto = z.infer<ReturnType<typeof makeSetupSchema>>;
