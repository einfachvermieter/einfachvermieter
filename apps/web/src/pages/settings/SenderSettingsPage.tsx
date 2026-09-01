import type {
  SenderSettingsUpdateDto,
  senderSettingsUpdateSchema,
} from "@einfachvermieter/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import type { z } from "zod";
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
import { SettingsLayout } from "./SettingsLayout";

const toFormDefaults = (
  settings: SenderSettings,
): z.input<typeof senderSettingsUpdateSchema> => ({
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
  logoMode: settings.logoMode,
  logoAlignment: settings.logoAlignment,
  logoScalePercent: String(settings.logoScalePercent),
});

export const SenderSettingsPage = () => {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(senderSettingsQueryOptions);
  const [pendingLogo, setPendingLogo] = useState<PendingLogo>(null);
  const [logoVersion, setLogoVersion] = useState(() => String(Date.now()));

  const goHome = useGoBack("/");

  const layout = (children: ReactNode) => (
    <SettingsLayout
      active="sender"
      title={t("ui.settings.sender.title")}
      description={t("ui.settings.sender.description")}
    >
      {children}
    </SettingsLayout>
  );

  if (settingsQuery.isPending) {
    return layout(<FormSkeleton rows={6} />);
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return layout(
      <p className="text-sm text-destructive">{t("common.saveFailed")}</p>,
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

  return layout(
    <SenderSettingsForm
      settings={settings}
      defaultValues={toFormDefaults(settings)}
      onSubmit={handleSubmit}
      onCancel={goHome}
      pendingLogo={pendingLogo}
      onPendingLogoChange={setPendingLogo}
      logoVersion={logoVersion}
    />,
  );
};
