import {
  RiExpandUpDownLine,
  RiLogoutBoxRLine,
  RiUserLine,
  RiUserSettingsLine,
} from "@remixicon/react";
import { Link } from "@tanstack/react-router";
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
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton
            asChild={true}
            size="lg"
            tooltip={displayName}
            className="h-auto px-2.5 py-1.5 data-[state=open]:bg-white/7 data-[state=open]:text-sidebar-accent-foreground"
          >
            <DropdownMenuTrigger>
              <RiUserLine aria-hidden={true} className="size-5 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium text-sidebar-accent-foreground">
                  {displayName}
                </span>
                {fullName ? (
                  <span className="truncate text-xs">{email}</span>
                ) : null}
              </span>
              <RiExpandUpDownLine className="ml-auto size-4 shrink-0" />
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
                <span className="truncate text-sm font-medium text-popover-foreground">
                  {fullName}
                </span>
              ) : null}
              <span className="truncate text-xs font-normal text-muted-foreground">
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild={true}>
              <Link to="/konto/profil">
                <RiUserSettingsLine />
                {t("ui.navigation.userAccount")}
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
  );
};
