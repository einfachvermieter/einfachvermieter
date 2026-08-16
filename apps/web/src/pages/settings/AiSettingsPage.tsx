import type { AiProvider } from "@einfachvermieter/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { FormSkeleton } from "@/components/FormSkeleton";
import { aiConfigQueryOptions } from "@/lib/aiExtraction";
import {
  AI_PROVIDER_NONE,
  type AiSettings,
  type AiSettingsUpdate,
  aiSettingsQueryOptions,
  updateAiSettings,
} from "@/lib/aiSettings";
import { t } from "@/lib/i18n";
import { useGoBack } from "@/lib/useGoBack";
import {
  AiSettingsForm,
  type AiSettingsFormValues,
  type AiSettingsSubmitOptions,
} from "./AiSettingsForm";
import { SettingsLayout } from "./SettingsLayout";

const toFormDefaults = (settings: AiSettings): AiSettingsFormValues => ({
  aiProvider: settings.aiProvider ?? AI_PROVIDER_NONE,
  aiApiKey: "",
  aiModel: settings.aiModel ?? "",
  aiBaseUrl: settings.aiBaseUrl ?? "",
});

/**
 * Setzt die Formularwerte auf das API-Format um.
 *
 * @param keepStoredApiKey Zeigt das Formular den gespeicherten API-Key noch an, bleibt er unangetastet und wird nicht mitgeschickt. Andernfalls gilt der Feldinhalt; leer bedeutet dann löschen.
 */
const toUpdateDto = (
  values: AiSettingsFormValues,
  keepStoredApiKey: boolean,
): AiSettingsUpdate => {
  const provider =
    values.aiProvider === AI_PROVIDER_NONE
      ? null
      : (values.aiProvider as AiProvider);

  return {
    aiProvider: provider,
    aiModel: values.aiModel.trim() || null,
    aiBaseUrl: values.aiBaseUrl.trim() || null,
    ...(keepStoredApiKey ? {} : { aiApiKey: values.aiApiKey.trim() }),
  };
};

export const AiSettingsPage = () => {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(aiSettingsQueryOptions);
  // Der gespeicherte API-Key ist zum Entfernen vorgemerkt; wirksam wird das
  // erst mit dem Speichern.
  const [apiKeyCleared, setApiKeyCleared] = useState(false);

  const goHome = useGoBack("/");

  const layout = (children: ReactNode) => (
    <SettingsLayout
      active="ai"
      title={t("ui.settings.ai.title")}
      description={t("ui.settings.ai.description")}
    >
      {children}
    </SettingsLayout>
  );

  if (settingsQuery.isPending) {
    return layout(<FormSkeleton rows={4} />);
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return layout(
      <p className="text-sm text-destructive">{t("common.saveFailed")}</p>,
    );
  }

  const settings = settingsQuery.data;

  const handleSubmit = async (
    values: AiSettingsFormValues,
    { keepStoredApiKey }: AiSettingsSubmitOptions,
  ) => {
    const updated = await updateAiSettings(
      toUpdateDto(values, keepStoredApiKey),
    );
    queryClient.setQueryData(aiSettingsQueryOptions.queryKey, updated);
    setApiKeyCleared(false);
    // Ob die Rechnungs-Erfassung den KI-Knopf anbietet, hängt an diesen
    // Einstellungen.
    await queryClient.invalidateQueries({
      queryKey: aiConfigQueryOptions.queryKey,
    });
  };

  return layout(
    <AiSettingsForm
      settings={settings}
      defaultValues={toFormDefaults(settings)}
      apiKeyCleared={apiKeyCleared}
      onApiKeyClear={() => setApiKeyCleared(true)}
      onSubmit={handleSubmit}
      onCancel={goHome}
    />,
  );
};
