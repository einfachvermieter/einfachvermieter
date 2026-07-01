import { RiContactsBook2Line, RiLockPasswordLine } from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHead } from "@/components/common/PageHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { t } from "@/lib/i18n";

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

  return (
    <div className="space-y-6 pb-24">
      <div className="space-y-4">
        <PageHead
          eyebrow={t("ui.settings.eyebrow")}
          title={title}
          sub={description}
        />
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
      </div>
      {children}
    </div>
  );
};
