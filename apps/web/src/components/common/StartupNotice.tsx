import type { ReactNode } from "react";
import { AppBrand } from "@/components/common/AppBrand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

/**
 * Hinweis-Karte für Zustände außerhalb der App (Server wird gesucht, Server
 * nicht erreichbar, Version zu alt): gleiche Gestaltung wie Anmeldung und
 * Einrichtung.
 */
export const StartupNotice = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) => (
  <div className="flex min-h-dvh items-center justify-center p-6">
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="pb-3">
              <AppBrand tone="light" />
            </div>
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
        </CardHeader>
        {children ? (
          <CardContent>
            <div className="flex justify-center">{children}</div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  </div>
);
