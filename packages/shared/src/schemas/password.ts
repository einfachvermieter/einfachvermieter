import { messageKey } from "@einfachvermieter/i18n";
import { z } from "zod";

/**
 * Passwort-Richtlinie. Bewusst lasch im Default (lokal gehostet / Electron):
 * nur eine Mindestlänge, keine Zeichenklassen-Pflicht. Per ENV verschärfbar.
 */
export type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
};

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireDigit: false,
  requireSpecial: false,
};

const PASSWORD_MAX_LENGTH = 200;

// Sonderzeichen = alles, was weder Buchstabe (inkl. Umlaute) noch Ziffer ist.
const HAS_UPPERCASE = /\p{Lu}/u;
const HAS_LOWERCASE = /\p{Ll}/u;
const HAS_DIGIT = /\d/u;
const HAS_SPECIAL = /[^\p{L}\p{N}]/u;

const parseBool = (raw: string | undefined): boolean =>
  raw !== undefined &&
  ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());

/**
 * Liest die Policy aus einer Environment-Map (z. B. `process.env`).
 */
export const passwordPolicyFromEnv = (
  env: Record<string, string | undefined>,
): PasswordPolicy => {
  const parsedMin = Number.parseInt(env.PASSWORD_MIN_LENGTH ?? "", 10);
  return {
    minLength:
      Number.isFinite(parsedMin) && parsedMin > 0
        ? parsedMin
        : DEFAULT_PASSWORD_POLICY.minLength,
    requireUppercase: parseBool(env.PASSWORD_REQUIRE_UPPERCASE),
    requireLowercase: parseBool(env.PASSWORD_REQUIRE_LOWERCASE),
    requireDigit: parseBool(env.PASSWORD_REQUIRE_DIGIT),
    requireSpecial: parseBool(env.PASSWORD_REQUIRE_SPECIAL),
  };
};

/**
 * Zod-Schema für ein Passwortfeld gemäß Policy. Fehlermeldungen als
 * `messageKey` - werden in der API (`ZodValidationPipe`) und im Frontend
 * (`FieldError`/`translateKey`) übersetzt.
 */
export const passwordSchema = (policy: PasswordPolicy) =>
  z.string().superRefine((value, ctx) => {
    if (value.length < policy.minLength) {
      ctx.addIssue({
        code: "custom",
        message: messageKey("ui.password.policy.minLength", {
          min: policy.minLength,
        }),
      });
    }
    if (value.length > PASSWORD_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: messageKey("validation.tooLong", { max: PASSWORD_MAX_LENGTH }),
      });
    }
    if (policy.requireUppercase && !HAS_UPPERCASE.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: messageKey("ui.password.policy.uppercase"),
      });
    }
    if (policy.requireLowercase && !HAS_LOWERCASE.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: messageKey("ui.password.policy.lowercase"),
      });
    }
    if (policy.requireDigit && !HAS_DIGIT.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: messageKey("ui.password.policy.digit"),
      });
    }
    if (policy.requireSpecial && !HAS_SPECIAL.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: messageKey("ui.password.policy.special"),
      });
    }
  });
