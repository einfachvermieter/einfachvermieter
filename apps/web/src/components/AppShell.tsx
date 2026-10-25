import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BetaNotice } from "./common/BetaNotice";
import { SectionToc } from "./common/SectionToc";
import { UpdateMessages } from "./common/UpdateMessages";
import { DocumentTitle } from "./DocumentTitle";
import { MainNavigation } from "./mainNavigation/MainNavigation";
import { TopBar } from "./mainNavigation/TopBar";
import { SidebarInset, SidebarProvider } from "./ui/Sidebar";

/**
 * Rahmen der App: Fensterleiste oben, darunter links die Sidebar des aktiven
 * Gebäudes und rechts der Inhalt auf einer weißen Fläche über dem Grund
 */
export const AppShell = ({ children }: { children?: ReactNode }) => (
  <SidebarProvider>
    <DocumentTitle />
    <BetaNotice />
    <UpdateMessages />
    <TopBar />
    <MainNavigation />

    <SidebarInset>
      <main className="flex-1 overflow-x-clip py-6 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* Seiten stehen in einer Spalte; Detailseiten bekommen rechts daneben ein Inhaltsverzeichnis */}
        <div className="flex w-full max-w-310 gap-10 *:first:min-w-0 *:first:flex-1 min-[90rem]:max-w-370">
          {children ?? <Outlet />}
          <SectionToc />
        </div>
      </main>
    </SidebarInset>
  </SidebarProvider>
);
