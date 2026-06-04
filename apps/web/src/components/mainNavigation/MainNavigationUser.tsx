import {
  RiExpandUpDownLine,
  RiLockPasswordLine,
  RiLogoutBoxRLine,
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
import { t } from "@/lib/i18n";

export const MainNavigationUser = ({
  email,
  onLogout,
}: {
  email: string;
  onLogout: () => void;
}) => {
  const { isMobile } = useSidebar();

  return (
    <div className="rounded-[13px] border border-sidebar-border bg-background group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <SidebarMenuButton
              asChild={true}
              size="lg"
              tooltip={email}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <DropdownMenuTrigger>
                <InitialsAvatar name={email} size={34} />
                <span className="flex-1 truncate text-left text-[13px] font-semibold">
                  {email}
                </span>
                <RiExpandUpDownLine className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
            </SidebarMenuButton>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                {email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild={true}>
                <Link to="/einstellungen/passwort">
                  <RiLockPasswordLine />
                  {t("ui.navigation.password")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onLogout}>
                <RiLogoutBoxRLine />
                {t("ui.common.action.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
};
