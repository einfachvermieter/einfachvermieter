import {
  AI_PROVIDER_INFO,
  AI_PROVIDERS,
  type AiProvider,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiExternalLinkLine,
  RiKey2Line,
  RiProhibitedLine,
  RiSparkling2Line,
} from "@remixicon/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Disclose } from "@/components/common/Disclose";
import { SectionCard } from "@/components/common/SectionCard";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AI_PROVIDER_NONE, type AiSettings } from "@/lib/aiSettings";
import { t } from "@/lib/i18n";
import { ApiKeyField } from "./ApiKeyField";
import { ProviderLogo } from "./ProviderLogo";

/**
 * Formularwerte. Der Anbieter ist hier immer ein String, damit die Auswahl
 * auch den Zustand „abgeschaltet" abbilden kann; die Umsetzung auf das
 * API-Format übernimmt die Seite.
 */
const aiSettingsFormSchema = z.object({
  aiProvider: z.string(),
  aiApiKey: z.string(),
  aiModel: z.string(),
  aiBaseUrl: z.string(),
});

export type AiSettingsFormValues = z.infer<typeof aiSettingsFormSchema>;

export type AiSettingsSubmitOptions = {
  /**
   * True, wenn der gespeicherte API-Key unangetastet bleiben soll, dann
   * wird er beim Speichern nicht mitgeschickt.
   */
  keepStoredApiKey: boolean;
};

type AiSettingsFormProps = {
  settings: AiSettings;
  defaultValues: AiSettingsFormValues;
  /**
   * Ob der Nutzer den gespeicherten API-Key zum Entfernen vorgemerkt hat
   */
  apiKeyCleared: boolean;
  onApiKeyClear: () => void;
  onSubmit: (
    values: AiSettingsFormValues,
    options: AiSettingsSubmitOptions,
  ) => Promise<void>;
  onCancel: () => void;
};

export const AiSettingsForm = ({
  settings,
  defaultValues,
  apiKeyCleared,
  onApiKeyClear,
  onSubmit,
  onCancel,
}: AiSettingsFormProps) => {
  const form = useForm<AiSettingsFormValues>({
    resolver: zodResolver(aiSettingsFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;
  const selected = form.watch("aiProvider");
  const provider = AI_PROVIDERS.find(
    (candidate): candidate is AiProvider => candidate === selected,
  );
  const info = provider ? AI_PROVIDER_INFO[provider] : null;

  // Der gespeicherte API-Key gehört zum gespeicherten Anbieter: nach einem
  // Wechsel verwirft ihn der Server ohnehin.
  const providerChanged =
    selected !== (settings.aiProvider ?? AI_PROVIDER_NONE);
  const storedKeyPreview =
    apiKeyCleared || providerChanged ? null : settings.apiKeyPreview;

  const envKeyAvailable =
    provider !== undefined &&
    settings.providersWithEnvApiKey.includes(provider);

  const providerOptions = [
    ...AI_PROVIDERS.map((candidate) => ({
      value: candidate,
      media: <ProviderLogo provider={candidate} />,
      title: t(`ui.settings.ai.providers.${candidate}.label`),
    })),
    {
      value: AI_PROVIDER_NONE,
      media: <RiProhibitedLine className="size-4.5 text-himbeere-500" />,
      title: t("ui.settings.ai.fields.providerNone"),
    },
  ];

  const handleSubmit = async (values: AiSettingsFormValues) => {
    await onSubmit(values, { keepStoredApiKey: storedKeyPreview !== null });
    // Der API-Key ist ein reines Schreibfeld: nach dem Speichern wieder
    // leeren, damit nichts im Klartext stehen bleibt.
    form.reset({ ...values, aiApiKey: "" });
  };

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <fieldset disabled={submitting} className="contents">
        <div>
          <SectionCard
            icon={RiSparkling2Line}
            title={t("ui.settings.ai.sections.provider")}
            description={t("ui.settings.ai.sections.providerDescription")}
          >
            <div className="flex flex-col gap-4">
              <ChoiceTilesInput
                control={form.control}
                name="aiProvider"
                options={providerOptions}
                columns={3}
              />
              {info && !info.supportsPdf ? (
                <Alert variant="warning">
                  <AlertDescription>
                    {t("ui.settings.ai.imagesOnlyNotice")}
                  </AlertDescription>
                </Alert>
              ) : null}
              {info?.requiresApiKey ? (
                <Alert variant="info">
                  <AlertDescription>
                    {t("ui.settings.ai.dataTransferNotice")}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </SectionCard>

          {provider && info ? (
            <SectionCard
              icon={RiKey2Line}
              title={t("ui.settings.ai.sections.connection")}
            >
              <div className="flex flex-col gap-4">
                {info.requiresApiKey ? (
                  <>
                    {envKeyAvailable ? (
                      <Alert variant="success">
                        <AlertDescription>
                          {t("ui.settings.ai.envKeyAvailable")}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <ApiKeyField
                      control={form.control}
                      name="aiApiKey"
                      preview={storedKeyPreview}
                      onClear={onApiKeyClear}
                      optional={envKeyAvailable}
                    />
                    {info.apiKeyUrl ? (
                      // Eigener Rahmen, damit der Textlink linksbündig an den
                      // Feldern klebt statt über die volle Breite zu zentrieren.
                      <div className="flex">
                        <Button variant="link" size="text" asChild={true}>
                          <a
                            href={info.apiKeyUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t("ui.settings.ai.keyLink", {
                              domain: new URL(info.apiKeyUrl).host,
                            })}
                            <RiExternalLinkLine />
                          </a>
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : null}

                <TextInput
                  control={form.control}
                  name="aiModel"
                  label={t("ui.settings.ai.fields.model")}
                  description={t("ui.settings.ai.fields.modelDescription")}
                  placeholder={info.defaultModel}
                  optional={true}
                />

                <Disclose label={t("ui.settings.ai.advanced")}>
                  <TextInput
                    control={form.control}
                    name="aiBaseUrl"
                    label={t("ui.settings.ai.fields.baseUrl")}
                    description={t("ui.settings.ai.fields.baseUrlDescription")}
                    placeholder={info.defaultBaseUrl}
                    optional={true}
                  />
                </Disclose>
              </div>
            </SectionCard>
          ) : null}
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            {t("ui.settings.ai.trademarkNotice")}
          </p>
        </div>
      </fieldset>
      <Savebar
        dirty={form.formState.isDirty}
        submitting={submitting}
        onCancel={onCancel}
      />
    </Form>
  );
};
