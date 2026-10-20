import {
  RiContactsBook2Line,
  RiGlobalLine,
  RiInformationLine,
} from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { PageHeaderIcon } from "@/components/common/PageHeaderIcon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { t } from "@/lib/i18n";
import { IconSparkle } from "@/lib/icons";

type SettingsTab = "sender" | "ai" | "internet" | "about";

const TAB_ROUTES: Record<SettingsTab, string> = {
  sender: "/einstellungen/absender",
  ai: "/einstellungen/ki",
  internet: "/einstellungen/internet",
  about: "/einstellungen/ueber",
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
    <div className="max-w-225 space-y-6 pb-24">
      <div className="space-y-4">
        <PageHeader
          tile={<PageHeaderIcon domain="configuration" />}
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
          <TabsList>
            <TabsTrigger value="sender">
              <RiContactsBook2Line />
              {t("ui.settings.nav.sender")}
            </TabsTrigger>
            <TabsTrigger value="ai">
              <IconSparkle />
              {t("ui.settings.nav.ai")}
            </TabsTrigger>
            <TabsTrigger value="internet">
              <RiGlobalLine />
              {t("ui.settings.nav.internet")}
            </TabsTrigger>
            <TabsTrigger value="about">
              <RiInformationLine />
              {t("ui.settings.nav.about")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {children}
    </div>
  );
};
