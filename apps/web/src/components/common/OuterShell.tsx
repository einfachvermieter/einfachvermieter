import type { ReactNode } from "react";
import { AppBrand } from "@/components/common/AppBrand";
import { BetaNotice } from "@/components/common/BetaNotice";
import { UpdateVersion } from "@/components/common/UpdateVersion";
import { desktopPlatform } from "@/lib/desktopShell";
import { cn } from "@/lib/utils";

const widthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-3xl",
} as const;

/**
 * Wrapper für alle Seiten außerhalb der App-Shell (Anmeldung, Einrichtung,
 * Passwort zurücksetzen, Hinweise, Absturz)
 */
export const OuterShell = ({
  width = "sm",
  betaNoticeAutoOpen = true,
  children,
}: {
  width?: keyof typeof widthClasses;
  /** `false` auf Status-, Sperr- und Fehlerseiten, siehe BetaNotice */
  betaNoticeAutoOpen?: boolean;
  children: ReactNode;
}) => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-sidebar p-6 in-data-desktop:pt-16">
    {/* Desktop-App: Ziehfläche des Fensters, auf dem Mac mit den
        Ampel-Buttons, unter Windows mit den Fenster-Buttons des Systems */}
    {desktopPlatform ? (
      <div data-drag-region={true} className="fixed inset-x-0 top-0 h-10" />
    ) : null}
    <BetaNotice autoOpen={betaNoticeAutoOpen} />
    <AppBrand tone="light" />
    <div className={cn("w-full", widthClasses[width])}>{children}</div>
    <p className="text-xs text-schiefer-500 tabular-nums">
      <UpdateVersion version={__APP_VERSION__} />
    </p>
  </div>
);
