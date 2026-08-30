import { RiAddLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/Sidebar";
import { t } from "@/lib/i18n";

/**
 * Ersatz für den Gebäude-Switcher, solange noch kein Gebäude existiert:
 * führt zur Gebäude-Liste, wo das erste Gebäude angelegt wird.
 */
export const NewBuildingButton = () => (
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={true}
        size="lg"
        tooltip={t("ui.navigation.buildingSwitcher.add")}
        className="h-auto rounded-lg border border-sidebar-border bg-white/8 px-2.5 py-2.5 text-sidebar-accent-foreground hover:border-sidebar-foreground hover:bg-white/8"
      >
        <Link to="/gebaeude">
          <RiAddLine className="text-sidebar-primary" />
          <span className="truncate text-sm font-semibold">
            {t("ui.navigation.buildingSwitcher.add")}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
);
