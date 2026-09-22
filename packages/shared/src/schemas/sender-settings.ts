import { messageKey, type TranslateFn } from "@einfachvermieter/i18n";
import { isValidIBAN } from "ibantools-germany";
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .max(max, messageKey("validation.tooLong", { max }))
    .nullable()
    .optional();

/**
 * Optionales IBAN-Feld: leer -> null; sonst Whitespace strippen, uppercase
 * und gegen `ibantools-germany` prüfen. Gleiches Verhalten wie bei den
 * Mieter-Bankkonten, nur dass hier der gesamte Eintrag optional ist.
 */
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

export const senderLogoModes = ["own", "app", "none"] as const;
export type SenderLogoMode = (typeof senderLogoModes)[number];
export const senderLogoAlignments = ["left", "center", "right"] as const;
export type SenderLogoAlignment = (typeof senderLogoAlignments)[number];
export const senderLogoScalePercents = [100, 75, 50] as const;
export type SenderLogoScalePercent = (typeof senderLogoScalePercents)[number];

export const toLogoMode = (value: string): SenderLogoMode =>
  (senderLogoModes as readonly string[]).includes(value)
    ? (value as SenderLogoMode)
    : "app";

export const toLogoAlignment = (value: string): SenderLogoAlignment =>
  (senderLogoAlignments as readonly string[]).includes(value)
    ? (value as SenderLogoAlignment)
    : "center";

export const toLogoScalePercent = (value: number): SenderLogoScalePercent =>
  (senderLogoScalePercents as readonly number[]).includes(value)
    ? (value as SenderLogoScalePercent)
    : 100;

export const senderSettingsUpdateSchema = z
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
    senderPhone: optionalText(50),
    senderFax: optionalText(50),
    senderEmail: z
      .union([
        z.literal(""),
        z
          .string()
          .email(messageKey("ui.settings.sender.validation.emailFormat")),
      ])
      .nullable()
      .optional(),
    senderBankName: optionalText(200),
    senderBankIban: optionalIban,
    senderBankBic: optionalText(20),
    logoMode: z.enum(senderLogoModes),
    logoAlignment: z.enum(senderLogoAlignments),
    logoScalePercent: z
      .union([z.string(), z.number()])
      .transform(Number)
      .refine(
        (value): value is SenderLogoScalePercent =>
          (senderLogoScalePercents as readonly number[]).includes(value),
        { message: messageKey("ui.settings.sender.validation.logoScale") },
      ),
  })
  .strict();

export type SenderSettingsUpdateDto = z.infer<
  typeof senderSettingsUpdateSchema
>;

export type SenderSettingsDto = SenderSettingsUpdateDto & {
  hasLogo: boolean;
  logoMimeType: string | null;
};

/**
 * Absender-Anschrift vollständig: Name, Straße, PLZ und Ort formen die
 * Absenderzeile im Adressfenster, der Ort zusätzlich die Datumszeile.
 * Ohne sie lässt sich eine Abrechnung nicht finalisieren.
 */
export const isSenderAddressComplete = (
  settings: Pick<
    SenderSettingsUpdateDto,
    | "senderName"
    | "senderAddressStreet"
    | "senderAddressPostalCode"
    | "senderAddressCity"
  >,
): boolean =>
  [
    settings.senderName,
    settings.senderAddressStreet,
    settings.senderAddressPostalCode,
    settings.senderAddressCity,
  ].every((value) => value.trim().length > 0);

/**
 * Absenderzeile im Adressfenster über dem Empfänger
 */
export const formatSenderLine = (
  translate: TranslateFn,
  sender: { name: string; street: string; postalCode: string; city: string },
): string =>
  [
    sender.name,
    sender.street,
    translate("statements.pdf.senderLocality", {
      postalCode: sender.postalCode.trim(),
      city: sender.city.trim(),
    }),
  ]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(translate("ui.common.separators.dash"));
