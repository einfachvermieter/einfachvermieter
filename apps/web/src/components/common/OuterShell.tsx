import type { ReactNode } from "react";
import { AppBrand } from "@/components/common/AppBrand";
import { UpdateVersion } from "@/components/common/UpdateVersion";
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
  children,
}: {
  width?: keyof typeof widthClasses;
  children: ReactNode;
}) => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-sidebar p-6">
    <AppBrand tone="dark" />
    <div className={cn("w-full", widthClasses[width])}>{children}</div>
    <p className="text-xs text-schiefer-500 tabular-nums">
      <UpdateVersion version={__APP_VERSION__} />
    </p>
  </div>
);
