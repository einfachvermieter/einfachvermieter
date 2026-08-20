import { RiAddLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { IconTile } from "@/components/common/IconTile";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/Sidebar";
import { gradients } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";

/**
 * Ersatz für den Gebäude-Switcher, solange noch kein Gebäude existiert:
 * führt direkt ins Anlage-Formular.
 */
export const NewBuildingButton = () => (
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={true}
        size="lg"
        tooltip={t("ui.navigation.buildingSwitcher.add")}
        className="h-auto rounded-[13px] py-3 pr-3 pl-3"
      >
        <Link to="/gebaeude/neu">
          <IconTile icon={RiAddLine} size={30} background={gradients.brand} />
          <span className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">
            {t("ui.navigation.buildingSwitcher.add")}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
);
