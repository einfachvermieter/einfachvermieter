import { useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/Sidebar";
import logoUrl from "../../img/logo/logo.svg";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { useCurrentUser, useLogout } from "../../lib/auth";
import { t } from "../../lib/i18n";
import { BuildingSwitcher } from "./BuildingSwitcher";
import { MainNavigationUser } from "./MainNavigationUser";
import { NavGroup } from "./NavGroup";
import { dashboardNav, kostenAbrechnungNav, stammdatenNav } from "./navConfig";

export const MainNavigation = () => {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { buildingId } = useActiveBuilding();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-12 items-center gap-2 px-2 transition-[gap,padding] duration-200 ease-linear group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-1.5">
          <img
            src={logoUrl}
            alt=""
            className="size-8 shrink-0 transition-[width,height] duration-200 ease-linear group-data-[collapsible=icon]:size-5"
          />
          <span className="max-w-48 truncate text-xl font-heading font-bold transition-[max-width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
            <span className="text-sky-700">{t("common.appName.Einfach")}</span>
            <span className="text-teal-600">
              {t("common.appName.Vermieter")}
            </span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup
          label={t("ui.navigation.groups.general")}
          items={dashboardNav}
          currentPath={currentPath}
        />

        <div className="mx-2 mt-1 rounded-lg border border-sidebar-border bg-sidebar-accent/40 pb-1 group-data-[collapsible=icon]:mx-1 group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:pb-0">
          <SidebarGroup>
            <BuildingSwitcher />
          </SidebarGroup>
          <NavGroup
            label={t("ui.navigation.groups.masterData")}
            items={stammdatenNav}
            currentPath={currentPath}
            buildingId={buildingId}
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
        {user ? (
          <MainNavigationUser
            email={user.email}
            onLogout={() => logout.mutate()}
          />
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
