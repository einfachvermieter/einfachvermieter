import {
  RiContactsBook2Line,
  RiGlobalLine,
  RiSparkling2Line,
} from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { PageHeaderIcon } from "@/components/common/PageHeaderIcon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { domainVisuals } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";

type SettingsTab = "sender" | "ai" | "internet";

const TAB_ROUTES: Record<SettingsTab, string> = {
  sender: "/einstellungen/absender",
  ai: "/einstellungen/ki",
  internet: "/einstellungen/internet",
};

/**
 * Rahmen des Einstellungen-Bereichs (App-Einstellungen): gemeinsamer
 * Seitenkopf und Unternavigation. Profil und Passwort des Anmelde-Kontos
 * liegen im eigenen Konto-Bereich (`AccountLayout`).
 */
export const SettingsLayout = ({
  active,
  title,
  description,
  children,
}: {
  active: SettingsTab;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 pb-24">
      <div className="space-y-4">
        <PageHeader
          tile={<PageHeaderIcon icon={domainVisuals.configuration.icon} />}
          title={title}
          sub={description}
          breadcrumb={false}
        />
        <Tabs
          value={active}
          onValueChange={(value) => {
            navigate({ to: TAB_ROUTES[value as SettingsTab] }).catch(
              () => undefined,
            );
          }}
        >
          <TabsList variant="default">
            <TabsTrigger value="sender">
              <RiContactsBook2Line />
              {t("ui.settings.nav.sender")}
            </TabsTrigger>
            <TabsTrigger value="ai">
              <RiSparkling2Line />
              {t("ui.settings.nav.ai")}
            </TabsTrigger>
            <TabsTrigger value="internet">
              <RiGlobalLine />
              {t("ui.settings.nav.internet")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {children}
    </div>
  );
};
