import { RiLockPasswordLine } from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import { ActionLink } from "@/components/common/ActionLink";
import { InfoCard } from "@/components/common/InfoCard";
import { domainVisuals } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";

/**
 * Rechte Infospalte der Absenderdaten
 */
export const SenderSettingsSidebar = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
      <InfoCard
        title={t("ui.settings.sender.sidebar.appearance")}
        rows={[
          {
            label: t("ui.settings.sender.sidebar.letterhead"),
            value: t("ui.settings.sender.sidebar.letterheadValue"),
          },
          {
            label: t("ui.settings.sender.sidebar.footer"),
            value: t("ui.settings.sender.sidebar.footerValue"),
          },
          {
            label: t("ui.settings.sender.sidebar.paymentHint"),
            value: t("ui.settings.sender.sidebar.paymentHintValue"),
          },
        ]}
      />
      <InfoCard title={t("ui.common.infoCards.links")}>
        <ActionLink
          icon={domainVisuals.statements.icon}
          iconBackground={domainVisuals.statements.accent}
          onClick={() => navigate({ to: "/abrechnungen" })}
        >
          {t("ui.navigation.statements")}
        </ActionLink>
        <ActionLink
          icon={RiLockPasswordLine}
          iconBackground={domainVisuals.configuration.accent}
          onClick={() => navigate({ to: "/einstellungen/passwort" })}
        >
          {t("ui.settings.password.title")}
        </ActionLink>
      </InfoCard>
    </div>
  );
};
