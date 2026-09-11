import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { AppBrand } from "@/components/common/AppBrand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/Sidebar";
import { statsQueryOptions } from "@/lib/stats";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { useCurrentUser, useLogout } from "../../lib/auth";
import { t } from "../../lib/i18n";
import { useAuthMode } from "../../lib/setup";
import { BuildingSwitcher } from "./BuildingSwitcher";
import { MainNavigationUser } from "./MainNavigationUser";
import { NavGroup } from "./NavGroup";
import { NewBuildingButton } from "./NewBuildingButton";
import {
  globalNav,
  kostenAbrechnungNav,
  settingsNav,
  stammdatenNav,
} from "./navConfig";
import { UpdateHint } from "./UpdateHint";

export const MainNavigation = () => {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const authMode = useAuthMode();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { buildingId, isPending: buildingsPending } = useActiveBuilding();
  // Zähl-Badges der Stammdaten-Gruppe (Anzahl im aktiven Gebäude)
  const { data: stats } = useQuery({
    ...statsQueryOptions(buildingId),
    enabled: buildingId !== undefined,
  });

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center px-2.5 pt-2 pb-3">
          <AppBrand stacked={true} />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <UpdateHint />
        <NavGroup items={globalNav} currentPath={currentPath} />

        <div className="px-1.5 pt-3">
          <SidebarGroupLabel>
            {t("ui.navigation.buildingSwitcher.label")}
          </SidebarGroupLabel>
          {buildingId === undefined && !buildingsPending ? (
            <NewBuildingButton />
          ) : null}
          {buildingId !== undefined ? <BuildingSwitcher /> : null}
        </div>

        {/* Gebäudebezogene Punkte, eingerückt mit Führungslinie */}
        {buildingId !== undefined ? (
          <div className="ml-4.5 border-l-2 border-sidebar-border pl-1.5">
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
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <NavGroup items={[settingsNav]} currentPath={currentPath} />
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
