import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/Sidebar";
import { statsQueryOptions } from "@/lib/stats";
import logoUrl from "../../img/logo/logo.svg";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { useCurrentUser, useLogout } from "../../lib/auth";
import { t } from "../../lib/i18n";
import { useAuthMode } from "../../lib/setup";
import { BuildingSwitcher } from "./BuildingSwitcher";
import { MainNavigationUser } from "./MainNavigationUser";
import { NavGroup } from "./NavGroup";
import { dashboardNav, kostenAbrechnungNav, stammdatenNav } from "./navConfig";
import { UpdateHint } from "./UpdateHint";

export const MainNavigation = () => {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const authMode = useAuthMode();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { buildingId } = useActiveBuilding();
  // Zähl-Badges der Stammdaten-Gruppe (Anzahl im aktiven Gebäude)
  const { data: stats } = useQuery({
    ...statsQueryOptions(buildingId),
    enabled: buildingId !== undefined,
  });

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex h-12 items-center gap-2 px-2">
          <img src={logoUrl} alt="" className="size-7 shrink-0" />
          <span className="max-w-48 truncate text-xl font-heading font-bold">
            <span className="text-sky-700">{t("common.appName.Einfach")}</span>
            <span className="text-teal-600">
              {t("common.appName.Vermieter")}
            </span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <UpdateHint />
        <div className="px-2.25">
          <NavGroup
            label={t("ui.navigation.groups.general")}
            items={dashboardNav}
            currentPath={currentPath}
          />
        </div>

        <div className="mx-2 mt-1 rounded-[14px] border border-sidebar-border bg-card pb-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="border-b border-sidebar-border">
            <BuildingSwitcher />
          </div>
          <NavGroup
            label={t("ui.navigation.groups.masterData")}
            items={stammdatenNav}
            currentPath={currentPath}
            buildingId={buildingId}
            counts={{
              units: stats?.units,
              meters: stats?.meters,
              tenants: stats?.tenants,
            }}
          />
          <NavGroup
            label={t("ui.navigation.groups.costsBilling")}
            items={kostenAbrechnungNav}
            currentPath={currentPath}
            buildingId={buildingId}
          />
        </div>
      </SidebarContent>

      <SidebarFooter>
        {/* Desktop-App (`local`): kein Konto, kein Benutzer-Menü  */}
        {user && authMode !== "local" ? (
          <MainNavigationUser
            email={user.email}
            firstName={user.firstName}
            lastName={user.lastName}
            onLogout={() => logout.mutate()}
          />
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
};
