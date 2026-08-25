import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logoUrl from "../img/logo/logo.svg";
import { ActiveBuildingProvider } from "../lib/activeBuilding";
import { DocumentTitle } from "./DocumentTitle";
import { MainNavigation } from "./mainNavigation/MainNavigation";
import { Separator } from "./ui/Separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/Sidebar";

export const AppShell = ({ children }: { children?: ReactNode }) => (
  <SidebarProvider>
    <ActiveBuildingProvider>
      <DocumentTitle />
      <MainNavigation />

      <SidebarInset>
        {/* Ab 1024 ist die Sidebar dauerhaft sichtbar; dann entfällt die Topbar
            und der Seitenkopf trägt Navigation und Titel. Auf Mobile bleibt eine
            Leiste mit Menü-Umschalter und Logo. */}
        <header className="sticky top-0 z-10 flex h-[calc(4rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b border-border bg-background/70 px-6 pt-[env(safe-area-inset-top)] backdrop-blur-lg sm:px-8 lg:hidden">
          <SidebarTrigger className="-mx-2" />

          <Separator
            orientation="vertical"
            className="mx-2 data-vertical:h-full"
          />

          <div className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt="EinfachVermieter"
              className="size-6 shrink-0"
            />
          </div>
        </header>

        <main className="flex-1 overflow-x-clip py-8 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]">
          <div className="mx-auto w-full max-w-310">
            {children ?? <Outlet />}
          </div>
        </main>
      </SidebarInset>
    </ActiveBuildingProvider>
  </SidebarProvider>
);
