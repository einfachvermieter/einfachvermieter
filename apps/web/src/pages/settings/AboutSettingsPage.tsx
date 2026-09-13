import {
  RiFingerprintLine,
  RiInformationLine,
  RiScalesLine,
  RiVerifiedBadgeLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "@/components/common/ExternalLink";
import { SectionCard } from "@/components/common/SectionCard";
import { UpdateVersion } from "@/components/common/UpdateVersion";
import { t } from "@/lib/i18n";
import { useLicenseUrl } from "@/lib/setup";
import { internetSettingsQueryOptions } from "@/lib/updates";
import { SettingsLayout } from "./SettingsLayout";

/**
 * Dauerhafter Ort für Version, Lizenz und den Hinweis zur Nutzung, die der
 * Einrichtungs-Assistent nur einmal zeigt. Dazu die Kennung, die mit der
 * Nutzungsstatistik übermittelt wird, damit sie nachvollziehbar ist.
 */
export const AboutSettingsPage = () => {
  const licenseUrl = useLicenseUrl();
  const internetSettings = useQuery(internetSettingsQueryOptions).data;

  // Die Card nur zeigen, wenn die Kennung relevant ist: Statistik ist an
  // oder es wurde schon einmal gesendet
  const showTelemetry =
    internetSettings?.telemetryEnabled === true ||
    Boolean(internetSettings?.installationId);

  return (
    <SettingsLayout
      active="about"
      title={t("ui.settings.about.title")}
      description={t("ui.settings.about.description")}
    >
      <div className="space-y-6">
        <SectionCard
          icon={RiVerifiedBadgeLine}
          title={t("ui.settings.about.versionCardTitle")}
        >
          <p className="inline-flex flex-wrap gap-x-1 text-sm text-muted-foreground">
            {t("ui.settings.about.installedVersion")}
            <UpdateVersion version={__APP_VERSION__} />
          </p>
        </SectionCard>

        <SectionCard icon={RiScalesLine} title={t("ui.about.license.title")}>
          <p className="text-sm text-muted-foreground">
            {licenseUrl ? (
              <ExternalLink
                href={licenseUrl}
                label={t("ui.about.license.name")}
              />
            ) : (
              t("ui.about.license.name")
            )}
          </p>
        </SectionCard>

        <SectionCard icon={RiInformationLine} title={t("ui.about.usage.title")}>
          <p className="text-sm text-muted-foreground">
            {t("ui.about.usage.text")}
          </p>
        </SectionCard>

        {showTelemetry ? (
          <SectionCard
            icon={RiFingerprintLine}
            title={t("ui.settings.about.installationIdCardTitle")}
          >
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              {internetSettings?.installationId ? (
                <p className="inline-flex flex-wrap gap-x-1">
                  {t("ui.settings.about.installationId")}
                  <span className="font-mono text-foreground">
                    {internetSettings.installationId}
                  </span>
                </p>
              ) : (
                <p>{t("ui.settings.about.installationIdNone")}</p>
              )}
              <p className="text-xs">
                {t("ui.settings.about.installationIdHint")}
              </p>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </SettingsLayout>
  );
};
