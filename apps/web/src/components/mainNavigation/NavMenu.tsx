import { Link } from "@tanstack/react-router";
import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/Sidebar";
import { domainVisuals } from "@/lib/domainVisuals";
import { t } from "../../lib/i18n";
import { isNavActive, type NavItem } from "./navConfig";

/**
 * Navigationspunkte ohne Gruppe
 */
export const NavMenu = ({
  items,
  currentPath,
  buildingId,
  counts,
}: {
  items: NavItem[];
  currentPath: string;
  buildingId?: string;
  counts?: Partial<Record<NavItem["domain"], number>>;
}) => (
  <SidebarMenu>
    {items.map((item) => {
      const active = isNavActive(item, currentPath);
      const visual = domainVisuals[item.domain];
      const itemLabel = t(item.labelKey);
      const count = counts?.[item.domain];
      return (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton
            asChild={true}
            size="nav"
            tooltip={itemLabel}
            isActive={active}
          >
            <Link to={item.to} search={buildingId ? { buildingId } : undefined}>
              <visual.icon aria-hidden={true} />
              <span>{itemLabel}</span>
            </Link>
          </SidebarMenuButton>
          {count !== undefined ? (
            <SidebarMenuBadge>{count}</SidebarMenuBadge>
          ) : null}
        </SidebarMenuItem>
      );
    })}
  </SidebarMenu>
);
