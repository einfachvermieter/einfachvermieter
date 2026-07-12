import { RiContactsBook2Line, RiLockPasswordLine } from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHead } from "@/components/common/PageHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { t } from "@/lib/i18n";
import { useAuthMode } from "@/lib/setup";

type SettingsTab = "sender" | "password";

/**
 * Rahmen des Einstellungen-Bereichs: gemeinsamer Eyebrow, Seitentitel und
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
        <PageHead
          eyebrow={t("ui.settings.eyebrow")}
          title={title}
          sub={description}
        />
        {/* Desktop-App (`local`): ohne Passwort-Seite bleibt nur ein
            einziger Tab übrig - dann ganz auf die Leiste verzichten. */}
        {authMode !== "local" ? (
          <Tabs
            value={active}
            onValueChange={(value) => {
              navigate({
                to:
                  value === "password"
                    ? "/einstellungen/passwort"
                    : "/einstellungen/absender",
              }).catch(() => undefined);
            }}
          >
            <TabsList variant="default">
              <TabsTrigger value="sender">
                <RiContactsBook2Line />
                {t("ui.settings.nav.sender")}
              </TabsTrigger>
              <TabsTrigger value="password">
                <RiLockPasswordLine />
                {t("ui.settings.nav.password")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
      </div>
      {children}
    </div>
  );
};
