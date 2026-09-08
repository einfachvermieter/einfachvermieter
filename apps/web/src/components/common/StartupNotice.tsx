import type { ReactNode } from "react";
import { OuterShell } from "@/components/common/OuterShell";
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
  <OuterShell width="md">
    <Card>
      <CardHeader>
        <div className="flex flex-col items-center gap-1 text-center">
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
  </OuterShell>
);
