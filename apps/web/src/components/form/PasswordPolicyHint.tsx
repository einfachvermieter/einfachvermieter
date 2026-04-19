import type { PasswordPolicy } from "@einfachvermieter/shared";
import { t } from "@/lib/i18n";

/**
 * Listet die aktiven Passwort-Anforderungen unter einem Passwortfeld auf
 */
export const PasswordPolicyHint = ({ policy }: { policy: PasswordPolicy }) => {
  const rules = [
    t("ui.password.policy.minLength", { min: policy.minLength }),
    policy.requireUppercase ? t("ui.password.policy.uppercase") : null,
    policy.requireLowercase ? t("ui.password.policy.lowercase") : null,
    policy.requireDigit ? t("ui.password.policy.digit") : null,
    policy.requireSpecial ? t("ui.password.policy.special") : null,
  ].filter((rule): rule is string => rule !== null);

  return (
    <span className="flex flex-col gap-0.5">
      {rules.map((rule) => (
        <span key={rule}>{rule}</span>
      ))}
    </span>
  );
};
