import {
  RiAddLine,
  RiCheckLine,
  RiCommunityLine,
  RiExpandUpDownLine,
} from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/Sidebar";
import { useActiveBuilding } from "@/lib/activeBuilding";
import { t } from "@/lib/i18n";

export const BuildingSwitcher = () => {
  const { isMobile } = useSidebar();
  const { building, buildings, buildingId, setBuildingId } =
    useActiveBuilding();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton
            asChild={true}
            size="lg"
            tooltip={
              building?.name ?? t("ui.navigation.buildingSwitcher.empty")
            }
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <DropdownMenuTrigger>
              <InitialsAvatar name={building?.name ?? "?"} size={34} />
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden text-left leading-none">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {t("ui.navigation.buildingSwitcher.label")}
                </span>
                <span className="truncate text-[13.5px] font-semibold">
                  {building?.name ?? t("ui.navigation.buildingSwitcher.empty")}
                </span>
              </div>
              <RiExpandUpDownLine className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
          </SidebarMenuButton>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t("ui.navigation.buildingSwitcher.switchLabel")}
            </DropdownMenuLabel>
            {buildings.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => setBuildingId(item.id)}
              >
                <InitialsAvatar name={item.name} size={29} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold">
                    {item.name}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {[
                      t("ui.navigation.buildingSwitcher.unitsCount", {
                        count: item.unitsCount,
                      }),
                      t("ui.dashboard.buildingsCard.tenantsCount", {
                        count: item.activeTenantsCount,
                      }),
                    ].join(t("ui.common.separators.bullet"))}
                  </span>
                </span>
                {item.id === buildingId ? (
                  <RiCheckLine className="text-sky-700 dark:text-sky-400" />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild={true}>
              <Link to="/gebaeude">
                <RiCommunityLine />
                {t("ui.navigation.buildingSwitcher.all")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild={true}>
              <Link to="/gebaeude/neu">
                <RiAddLine />
                {t("ui.navigation.buildingSwitcher.add")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
