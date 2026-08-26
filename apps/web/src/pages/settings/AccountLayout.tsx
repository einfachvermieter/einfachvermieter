import { RiLockPasswordLine, RiUserLine } from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { PageHeaderIcon } from "@/components/common/PageHeaderIcon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { t } from "@/lib/i18n";

type AccountTab = "profile" | "password";

const TAB_ROUTES: Record<AccountTab, string> = {
  profile: "/konto/profil",
  password: "/konto/passwort",
};

/**
 * Rahmen des Konto-Bereichs (Anmelde-Konto des Nutzers)
 */
export const AccountLayout = ({
  active,
  title,
  description,
  children,
}: {
  active: AccountTab;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 pb-24">
      <div className="space-y-4">
        <PageHeader
          tile={<PageHeaderIcon icon={RiUserLine} />}
          title={title}
          sub={description}
          breadcrumb={false}
        />
        <Tabs
          value={active}
          onValueChange={(value) => {
            navigate({ to: TAB_ROUTES[value as AccountTab] }).catch(
              () => undefined,
            );
          }}
        >
          <TabsList variant="default">
            <TabsTrigger value="profile">
              <RiUserLine />
              {t("ui.settings.nav.profile")}
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
