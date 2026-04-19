import { Link } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/Sidebar";
import { t } from "../../lib/i18n";
import { isNavActive, type NavItem } from "./navConfig";

export const NavGroup = ({
  label,
  items,
  currentPath,
  buildingId,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;

  /**
   * Wenn gesetzt, tragen die Links dieser (gebäudegebundenen) Gruppe die
   * buildingId.
   */
  buildingId?: string;
}) => (
  <SidebarGroup>
    <SidebarGroupLabel>{label}</SidebarGroupLabel>
    <SidebarMenu>
      {items.map((item) => {
        const active = isNavActive(item, currentPath);
        const Icon = active ? item.iconActive : item.icon;
        const itemLabel = t(item.labelKey);
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              asChild={true}
              tooltip={itemLabel}
              isActive={active}
            >
              <Link
                to={item.to}
                search={buildingId ? { buildingId } : undefined}
              >
                <Icon />
                <span>{itemLabel}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  </SidebarGroup>
);
