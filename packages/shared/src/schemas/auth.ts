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
