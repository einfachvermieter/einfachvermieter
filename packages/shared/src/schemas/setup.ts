import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { buildingCreateSchema } from "./buildings.js";
import { type PasswordPolicy, passwordSchema } from "./password.js";

/**
 * Antwort von `GET /api/setup/status`.
 */
export type SetupStatus = {
  needsSetup: boolean;
};

/**
 * Eingabe des Erststart-Assistenten. Schritt 1 (Admin-Konto) ist Pflicht;
 * Absender (Schritt 2) und erstes Gebäude (Schritt 3) sind überspringbar.
 * Der Endpoint ist serverseitig hart gesperrt, sobald ein Benutzer existiert.
 * Das Admin-Passwort wird gegen die (per ENV konfigurierbare) Policy geprüft.
 */
export const makeSetupSchema = (policy: PasswordPolicy) =>
  z.object({
    admin: z.object({
      email: z.string().email(messageKey("ui.setup.validation.emailFormat")),
      password: passwordSchema(policy),
    }),
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
