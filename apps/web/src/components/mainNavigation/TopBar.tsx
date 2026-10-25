import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppBrand } from "@/components/common/AppBrand";
import { Button } from "@/components/ui/Button";
import { SidebarTrigger } from "@/components/ui/Sidebar";
import { useCurrentUser, useLogout } from "../../lib/auth";
import {
  desktopPlatform,
  onDesktopFullScreenChange,
} from "../../lib/desktopShell";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { useAuthMode } from "../../lib/setup";
import { cn } from "../../lib/utils";
import { MainNavigationUser } from "./MainNavigationUser";
import { globalNav, isNavActive, type NavItem, settingsNav } from "./navConfig";

/**
 * Eintrag der Fensterleiste: flach, der aktive erhaben in Limette wie in der
 * Sidebar, weil ein zweiter Klick zum Anfang des Bereichs zurückführt
 */
const TopBarLink = ({
  item,
  currentPath,
}: {
  item: NavItem;
  currentPath: string;
}) => {
  const visual = domainVisuals[item.domain];
  return (
    <Button
      asChild={true}
      variant={isNavActive(item, currentPath) ? "current" : "ghost"}
    >
      <Link to={item.to}>
        <visual.icon aria-hidden={true} />
        <span className="max-md:sr-only">{t(item.labelKey)}</span>
      </Link>
    </Button>
  );
};

/**
 * Fensterleiste über Sidebar und Inhalt: alles, was zur ganzen App gehört.
 * Die Sidebar darunter gehört dem aktiven Gebäude. Auf dem Mac sitzt links
 * die Ampel des Systems, das Logo steht dann mittig; unter Windows zeichnet
 * das System Titelleiste und Menüzeile darüber.
 */
export const TopBar = () => {
  const currentPath = useRouterState().location.pathname;
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const authMode = useAuthMode();
  const [fullScreen, setFullScreen] = useState(false);
  const mac = desktopPlatform === "mac";

  // Im Vollbild blendet macOS die Ampel aus, ihr Platz wird frei
  useEffect(() => onDesktopFullScreenChange(setFullScreen), []);

  return (
    <header
      data-drag-region={true}
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex h-(--app-bar-height) items-center gap-1 bg-sidebar px-3 pt-[env(safe-area-inset-top)]",
        mac && !fullScreen && "pl-21",
      )}
    >
      <SidebarTrigger className="lg:hidden" />
      <div
        className={cn(
          "flex shrink-0 items-center",
          mac
            ? "absolute left-1/2 -translate-x-1/2 max-lg:static max-lg:translate-x-0"
            : "min-w-[calc(var(--sidebar-width)-var(--spacing)*3)] pr-3 pl-2.5 max-lg:min-w-0",
        )}
      >
        <Link to="/" className="flex rounded-md">
          <AppBrand tone="light" size="sm" />
        </Link>
      </div>
      {globalNav.map((item) => (
        <TopBarLink key={item.to} item={item} currentPath={currentPath} />
      ))}
      <div className="grow" />
      <TopBarLink item={settingsNav} currentPath={currentPath} />
      {/* Desktop-App (`local`): kein Konto, kein Benutzer-Menü */}
      {user && authMode !== "local" ? (
        <MainNavigationUser
          email={user.email}
          firstName={user.firstName}
          lastName={user.lastName}
          onLogout={() => logout.mutate()}
        />
      ) : null}
    </header>
  );
};
