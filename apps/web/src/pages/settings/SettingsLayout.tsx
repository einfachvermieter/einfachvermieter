import {
  RiCloudLine,
  RiContactsBook2Line,
  RiLockPasswordLine,
  RiSparkling2Line,
  RiUserLine,
} from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { IconTile } from "@/components/common/IconTile";
import { PageHeader } from "@/components/common/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { domainVisuals, gradients } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";
import { useAuthMode } from "@/lib/setup";

type SettingsTab = "profile" | "sender" | "ai" | "climate" | "password";

const TAB_ROUTES: Record<SettingsTab, string> = {
  profile: "/einstellungen/profil",
  sender: "/einstellungen/absender",
  ai: "/einstellungen/ki",
  climate: "/einstellungen/klimafaktoren",
  password: "/einstellungen/passwort",
};

/**
 * Rahmen des Einstellungen-Bereichs: gemeinsamer Seitenkopf und
 * Unternavigation
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
  const authMode = useAuthMode();

  return (
    <div className="space-y-6 pb-24">
      <div className="space-y-4">
        <PageHeader
          tile={
            <IconTile
              icon={domainVisuals.configuration.icon}
              size={44}
              background={gradients.slate}
            />
          }
          title={title}
          sub={description}
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
            {/* Desktop-App (`local`): dort gibt es kein Anmelde-Konto,
                also auch keine Profil- und Passwort-Seite. */}
            {authMode !== "local" ? (
              <TabsTrigger value="profile">
                <RiUserLine />
                {t("ui.settings.nav.profile")}
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="sender">
              <RiContactsBook2Line />
              {t("ui.settings.nav.sender")}
            </TabsTrigger>
            <TabsTrigger value="ai">
              <RiSparkling2Line />
              {t("ui.settings.nav.ai")}
            </TabsTrigger>
            <TabsTrigger value="climate">
              <RiCloudLine />
              {t("ui.settings.nav.climateFactors")}
            </TabsTrigger>
            {authMode !== "local" ? (
              <TabsTrigger value="password">
                <RiLockPasswordLine />
                {t("ui.settings.nav.password")}
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>
      </div>
      {children}
    </div>
  );
};
