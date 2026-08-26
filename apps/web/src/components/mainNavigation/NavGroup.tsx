import { Link } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/Sidebar";
import { domainVisuals } from "@/lib/domainVisuals";
import { t } from "../../lib/i18n";
import { isNavActive, type NavItem } from "./navConfig";

export const NavGroup = ({
  label,
  items,
  currentPath,
  buildingId,
  counts,
}: {
  /**
   * Ohne Label entfällt die Gruppenüberschrift
   */
  label?: string;
  items: NavItem[];
  currentPath: string;

  /**
   * Wenn gesetzt, tragen die Links dieser (gebäudegebundenen) Gruppe die
   * buildingId.
   */
  buildingId?: string;

  /** Zähl-Badges je Domäne (Anzahl im aktiven Gebäude) */
  counts?: Partial<Record<NavItem["domain"], number>>;
}) => (
  <SidebarGroup>
    {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
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
              <Link
                to={item.to}
                search={buildingId ? { buildingId } : undefined}
              >
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
  </SidebarGroup>
);
