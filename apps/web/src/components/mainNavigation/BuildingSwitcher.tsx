import { RiCheckLine, RiExpandUpDownLine } from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/Sidebar";
import { useActiveBuilding } from "@/lib/activeBuilding";
import { domainVisuals } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";

const BuildingIcon = domainVisuals.buildings.icon;

export const BuildingSwitcher = () => {
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
            className="h-auto rounded-lg border border-sidebar-border bg-white/8 px-2.5 py-2 text-sidebar-accent-foreground hover:border-sidebar-foreground hover:bg-white/8 data-[state=open]:border-sidebar-foreground"
          >
            <DropdownMenuTrigger>
              <BuildingIcon
                aria-hidden={true}
                className="size-4.5 shrink-0 text-sidebar-foreground"
              />
              <span className="flex-1 truncate text-left text-sm font-semibold">
                {building?.name ?? t("ui.navigation.buildingSwitcher.empty")}
              </span>
              <RiExpandUpDownLine className="ml-auto size-4 shrink-0 text-sidebar-foreground" />
            </DropdownMenuTrigger>
          </SidebarMenuButton>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-52"
            side="bottom"
            align="start"
            sideOffset={4}
          >
            {buildings.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => setBuildingId(item.id)}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.name}
                </span>
                <RiCheckLine
                  className={
                    item.id === buildingId ? "text-limette-700" : "invisible"
                  }
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
