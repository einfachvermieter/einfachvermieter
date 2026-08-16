import {
  RiExpandUpDownLine,
  RiLockPasswordLine,
  RiLogoutBoxRLine,
} from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { MenuIconTile } from "@/components/common/MenuIconTile";
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
} from "@/components/ui/Sidebar";
import { t } from "@/lib/i18n";

export const MainNavigationUser = ({
  email,
  firstName,
  lastName,
  onLogout,
}: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  onLogout: () => void;
}) => {
  // Voller Name als primäre Zeile, E-Mail darunter; ohne Namen die E-Mail
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const displayName = fullName || email;

  return (
    <div className="rounded-[13px] border border-sidebar-border bg-card group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <SidebarMenuButton
              asChild={true}
              size="lg"
              tooltip={displayName}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <DropdownMenuTrigger>
                <InitialsAvatar name={displayName} size={34} />
                <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                  <span className="truncate text-[13px] font-semibold">
                    {displayName}
                  </span>
                  {fullName ? (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {email}
                    </span>
                  ) : null}
                </span>
                <RiExpandUpDownLine className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
            </SidebarMenuButton>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              side="top"
              align="start"
              sideOffset={4}
            >
              <DropdownMenuLabel className="flex min-w-0 flex-col">
                {fullName ? (
                  <span className="truncate text-[13px] font-semibold text-popover-foreground">
                    {fullName}
                  </span>
                ) : null}
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild={true}>
                <Link to="/einstellungen/passwort">
                  <MenuIconTile icon={RiLockPasswordLine} />
                  {t("ui.navigation.password")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onLogout}>
                <MenuIconTile icon={RiLogoutBoxRLine} />
                {t("ui.common.action.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
};
