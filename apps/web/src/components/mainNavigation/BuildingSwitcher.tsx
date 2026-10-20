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
import { IconCheck, IconChevronDown } from "@/lib/icons";

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
            className="h-10 rounded-lg border border-edge bg-white px-3 text-sidebar-accent-foreground shadow-key hover:bg-schiefer-50 active:shadow-none data-[state=open]:bg-schiefer-50"
          >
            <DropdownMenuTrigger>
              <BuildingIcon
                aria-hidden={true}
                className="size-4.5 shrink-0 text-azur-700"
              />
              <span className="flex-1 truncate text-left text-sm font-semibold">
                {building?.name ?? t("ui.navigation.buildingSwitcher.empty")}
              </span>
              <IconChevronDown className="ml-auto size-4 shrink-0 text-azur-700" />
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
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {item.name}
                </span>
                <IconCheck
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
