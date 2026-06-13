import type { SenderSettingsUpdateDto } from "@einfachvermieter/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Description } from "@/components/common/Description";
import { PageHead } from "@/components/common/PageHead";
import { FormSkeleton } from "@/components/FormSkeleton";
import { t } from "@/lib/i18n";
import {
  deleteSenderLogo,
  type PendingLogo,
  type SenderSettings,
  senderSettingsQueryOptions,
  updateSenderSettings,
  uploadSenderLogo,
} from "@/lib/senderSettings";
import { useGoBack } from "@/lib/useGoBack";
import { SenderSettingsForm } from "./SenderSettingsForm";

const toFormDefaults = (settings: SenderSettings): SenderSettingsUpdateDto => ({
  senderName: settings.senderName,
  senderAddressStreet: settings.senderAddressStreet,
  senderAddressPostalCode: settings.senderAddressPostalCode,
  senderAddressCity: settings.senderAddressCity,
  senderPhone: settings.senderPhone ?? "",
  senderFax: settings.senderFax ?? "",
  senderEmail: settings.senderEmail ?? "",
  senderBankName: settings.senderBankName ?? "",
  senderBankIban: settings.senderBankIban ?? "",
  senderBankBic: settings.senderBankBic ?? "",
  useLogo: settings.useLogo,
});

export const SenderSettingsPage = () => {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(senderSettingsQueryOptions);
  const [pendingLogo, setPendingLogo] = useState<PendingLogo>(null);
  const [logoVersion, setLogoVersion] = useState(() => String(Date.now()));

  const goHome = useGoBack("/");

  if (settingsQuery.isPending) {
    return (
      <div className="space-y-6">
        <PageHead
          eyebrow={t("ui.navigation.configuration")}
          title={t("ui.settings.sender.title")}
        />
        <FormSkeleton rows={6} />
      </div>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <div className="space-y-6">
        <PageHead
          eyebrow={t("ui.navigation.configuration")}
          title={t("ui.settings.sender.title")}
        />
        <p className="text-sm text-destructive">{t("common.saveFailed")}</p>
      </div>
    );
  }

  const settings = settingsQuery.data;

  // Logo-Änderung wird bewusst erst hier (beim Speichern) committet, nicht
  // schon bei der Dateiauswahl. Reihenfolge: erst Textfelder, dann das Logo,
  // damit die finale Antwort beide Änderungen widerspiegelt.
  const handleSubmit = async (values: SenderSettingsUpdateDto) => {
    let updated = await updateSenderSettings(values);

    if (pendingLogo?.kind === "replace") {
      updated = await uploadSenderLogo(pendingLogo.file);
    } else if (pendingLogo?.kind === "delete") {
      updated = await deleteSenderLogo();
    }

    queryClient.setQueryData(senderSettingsQueryOptions.queryKey, updated);

    if (pendingLogo) {
      setLogoVersion(String(Date.now()));
      setPendingLogo(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PageHead
          eyebrow={t("ui.navigation.configuration")}
          title={t("ui.settings.sender.title")}
        />
        <Description>{t("ui.settings.sender.description")}</Description>
      </div>
      <SenderSettingsForm
        settings={settings}
        defaultValues={toFormDefaults(settings)}
        onSubmit={handleSubmit}
        onCancel={goHome}
        pendingLogo={pendingLogo}
        onPendingLogoChange={setPendingLogo}
        logoVersion={logoVersion}
      />
    </div>
  );
};
