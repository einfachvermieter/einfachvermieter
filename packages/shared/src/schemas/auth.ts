import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";
import { type PasswordPolicy, passwordSchema } from "./password.js";

/**
 * Schema fürs Passwort-Ändern. Das neue Passwort wird gegen die (per ENV
 * konfigurierbare) Policy geprüft.
 */
export const makePasswordChangeSchema = (policy: PasswordPolicy) =>
  z
    .object({
      currentPassword: z
        .string()
        .min(1, messageKey("ui.settings.password.validation.currentRequired")),
      newPassword: passwordSchema(policy),
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: messageKey("ui.settings.password.validation.mustDiffer"),
      path: ["newPassword"],
    });

export type PasswordChangeDto = {
  currentPassword: string;
  newPassword: string;
};

/**
 * Schema fürs Zurücksetzen eines vergessenen Passworts. Ohne altes Passwort,
 * dafür nur im Rücksetz-Modus erreichbar (Umgebungsvariable beim Start des
 * Containers). Die E-Mail-Adresse benennt das Konto, `code` ist der Wert
 * dieser Umgebungsvariable und belegt, dass jemand den Container bedient.
 */
export const makePasswordRecoverySchema = (policy: PasswordPolicy) =>
  z.object({
    email: z.string().email(messageKey("ui.auth.emailInvalid")),
    code: z.string().min(1, messageKey("validation.required")),
    newPassword: passwordSchema(policy),
  });

export type PasswordRecoveryDto = {
  email: string;
  code: string;
  newPassword: string;
};
