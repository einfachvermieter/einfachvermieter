import {
  RiAddLine,
  RiCheckLine,
  RiCommunityLine,
  RiExpandUpDownLine,
  RiListSettingsLine,
} from "@remixicon/react";
import { Link } from "@tanstack/react-router";
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
              <RiCommunityLine />
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden text-left leading-none">
                <span className="text-xs text-muted-foreground">
                  {t("ui.navigation.buildingSwitcher.label")}
                </span>
                <span className="truncate font-semibold">
                  {building?.name ?? t("ui.navigation.buildingSwitcher.empty")}
                </span>
              </div>
              <RiExpandUpDownLine className="ml-auto size-4" />
            </DropdownMenuTrigger>
          </SidebarMenuButton>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t("ui.navigation.buildingSwitcher.label")}
            </DropdownMenuLabel>
            {buildings.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => setBuildingId(item.id)}
              >
                <RiCommunityLine />
                <span className="flex-1 truncate">{item.name}</span>
                {item.id === buildingId ? <RiCheckLine /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild={true}>
              <Link to="/gebaeude">
                <RiListSettingsLine />
                {t("ui.navigation.buildingSwitcher.manage")}
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
