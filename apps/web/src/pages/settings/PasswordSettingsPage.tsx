import type { PasswordChangeDto } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Spinner } from "@/components/common/Spinner";
import { changePassword, passwordPolicyQueryOptions } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { useGoBack } from "@/lib/useGoBack";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { SettingsLayout } from "./SettingsLayout";

export const PasswordSettingsPage = () => {
  const { data: policy } = useQuery(passwordPolicyQueryOptions);

  const goHome = useGoBack("/");

  // Fehler laufen über das Form-Error-Handling (inline am Feld), daher
  // hier nur der Erfolgs-Toast, kein useCrudMutation nötig (keine
  // Query-Invalidierung, das Passwort liegt in keiner Query).
  const handleSubmit = async (values: PasswordChangeDto) => {
    await changePassword(values);
    toast.success(t("ui.settings.password.saveSuccess"));
  };

  return (
    <SettingsLayout
      active="password"
      title={t("ui.settings.password.title")}
      description={t("ui.settings.password.description")}
    >
      {policy ? (
        <PasswordChangeForm
          policy={policy}
          onSubmit={handleSubmit}
          onCancel={goHome}
        />
      ) : (
        <div className="flex justify-center py-6">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      )}
    </SettingsLayout>
  );
};
