import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/Sidebar";
import { NavMenu } from "./NavMenu";
import type { NavItem } from "./navConfig";

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
    <NavMenu
      items={items}
      currentPath={currentPath}
      buildingId={buildingId}
      counts={counts}
    />
  </SidebarGroup>
);
