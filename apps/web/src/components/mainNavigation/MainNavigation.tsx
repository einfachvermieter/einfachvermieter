import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar, SidebarContent } from "@/components/ui/Sidebar";
import { statsQueryOptions } from "@/lib/stats";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { t } from "../../lib/i18n";
import { BuildingSwitcher } from "./BuildingSwitcher";
import { NavGroup } from "./NavGroup";
import { NewBuildingButton } from "./NewBuildingButton";
import { kostenAbrechnungNav, stammdatenNav } from "./navConfig";
import { UpdateHint } from "./UpdateHint";

/**
 * Sidebar: gehört dem aktiven Gebäude. Oben der Gebäude-Umschalter, darunter
 * die Bereiche des Gebäudes. Was zur ganzen App gehört (Übersicht, Gebäude,
 * Einstellungen, Nutzer), steht in der Fensterleiste
 */
export const MainNavigation = () => {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { buildingId, isPending: buildingsPending } = useActiveBuilding();
  // Zähl-Badges der Stammdaten-Gruppe (Anzahl im aktiven Gebäude)
  const { data: stats } = useQuery({
    ...statsQueryOptions(buildingId),
    enabled: buildingId !== undefined,
  });

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarContent>
        <UpdateHint />
        <div className="px-2 pt-1">
          {buildingId === undefined && !buildingsPending ? (
            <NewBuildingButton />
          ) : null}
          {buildingId !== undefined ? <BuildingSwitcher /> : null}
        </div>

        {buildingId !== undefined ? (
          <>
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
          </>
        ) : null}
      </SidebarContent>
    </Sidebar>
  );
};
