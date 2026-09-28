import { RiSideBarLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import logoDarkUrl from "../../img/logo/logo_dark.svg";
import { openBetaNotice, showBetaMarker } from "../../lib/appVersion";
import {
  desktopPlatform,
  onDesktopFullScreenChange,
} from "../../lib/desktopShell";
import { t } from "../../lib/i18n";
import { Badge } from "../ui/Badge";
import { useSidebar } from "../ui/Sidebar";
import { DesktopBreadcrumb } from "./DesktopBreadcrumb";
import { DesktopMenuBar } from "./DesktopMenuBar";

/**
 * Titelleiste der Desktop-App über der ganzen Oberfläche, zugleich
 * Ziehfläche des Fensters. Links das Logo, unter 1024 px davor der
 * Sidebar-Umschalter (eine Topbar gibt es in der Desktop-App nicht).
 * Windows: Menüzeile, rechts zeichnet das System die Fenster-Buttons.
 * Mac: links Platz für die Ampel-Buttons, dann der Pfad der Seite, rechts
 * der Beta-Hinweis.
 */
export const DesktopTitleBar = () => {
  const { toggleSidebar } = useSidebar();
  const [fullScreen, setFullScreen] = useState(false);

  // Im Vollbild blendet macOS die Ampel-Buttons aus, ihr Platz wird frei
  useEffect(() => onDesktopFullScreenChange(setFullScreen), []);

  const betaBadge = showBetaMarker ? (
    <button
      type="button"
      onClick={openBetaNotice}
      className="flex cursor-help rounded-full"
    >
      <Badge variant="warn">{t("ui.beta.badge")}</Badge>
    </button>
  ) : null;

  return (
    <div
      data-drag-region={true}
      className="fixed inset-x-0 top-0 z-60 h-10 bg-sidebar text-xs text-schiefer-200"
    >
      <div className="flex h-full w-[env(titlebar-area-width,100%)] items-center gap-0.5 pl-3">
        <div
          data-slot="desktop-brand"
          className="mr-3.5 flex shrink-0 items-center"
        >
          {desktopPlatform === "mac" && !fullScreen ? (
            <div className="w-18 shrink-0" />
          ) : null}
          <button
            type="button"
            onClick={toggleSidebar}
            className="mr-1.5 rounded-sm p-1.5 outline-none hover:bg-schiefer-800 focus-visible:bg-schiefer-800 lg:hidden"
          >
            <RiSideBarLine aria-hidden={true} className="size-4" />
            <span className="sr-only">{t("ui.common.a11y.toggleSidebar")}</span>
          </button>
          <div className="flex items-center gap-2 pl-0.5">
            <img src={logoDarkUrl} alt="" className="size-5 shrink-0" />
            <span className="font-heading text-sm font-semibold tracking-heading text-schiefer-50">
              {t("common.appName.EinfachVermieter")}
            </span>
            {desktopPlatform === "win" ? betaBadge : null}
          </div>
        </div>

        {desktopPlatform === "win" ? <DesktopMenuBar /> : <DesktopBreadcrumb />}

        {desktopPlatform === "mac" ? (
          <div className="ml-auto shrink-0 pr-3 pl-4">{betaBadge}</div>
        ) : null}
      </div>
    </div>
  );
};
