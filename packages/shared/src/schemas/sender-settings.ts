import { messageKey } from "@einfachvermieter/i18n";
import { isValidIBAN } from "ibantools-germany";
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .max(max, messageKey("validation.tooLong", { max }))
    .nullable()
    .optional();

// Optionales IBAN-Feld: leer -> null; sonst Whitespace strippen, uppercase
// und gegen `ibantools-germany` prüfen. Gleiches Verhalten wie bei den
// Mieter-Bankkonten, nur dass hier der gesamte Eintrag optional ist.
const optionalIban = z
  .union([z.literal(""), z.string()])
  .nullable()
  .optional()
  .transform((value) =>
    typeof value === "string" && value.length > 0
      ? value.replace(/\s+/gu, "").toUpperCase()
      : null,
  )
  .pipe(
    z
      .string()
      .refine((iban) => isValidIBAN(iban), {
        message: messageKey("ui.settings.sender.validation.invalidIban"),
      })
      .nullable(),
  );

export const senderSettingsUpdateSchema = z.object({
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
  senderPhone: optionalText(50),
  senderFax: optionalText(50),
  senderEmail: z
    .union([
      z.literal(""),
      z.string().email(messageKey("ui.settings.sender.validation.emailFormat")),
    ])
    .nullable()
    .optional(),
  senderBankName: optionalText(200),
  senderBankIban: optionalIban,
  senderBankBic: optionalText(20),
  useLogo: z.boolean(),
});

export type SenderSettingsUpdateDto = z.infer<
  typeof senderSettingsUpdateSchema
>;

export type SenderSettingsDto = SenderSettingsUpdateDto & {
  hasLogo: boolean;
  logoMimeType: string | null;
};
