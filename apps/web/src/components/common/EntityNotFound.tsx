import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { NotFound } from "@/components/NotFound";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

/**
 * "Nicht gefunden"-Ansicht für Edit-Seiten, deren Loader keinen Datensatz
 * liefert: Titel/Beschreibung plus "Zurück zur Übersicht"-Button.
 */
export const EntityNotFound = ({
  title,
  description,
  to,
  params,
  search,
}: {
  title: ReactNode;
  description?: ReactNode;
  to: string;
  params?: Record<string, string | undefined>;
  search?: Record<string, unknown>;
}) => (
  <NotFound
    title={title}
    description={description}
    action={
      <Button asChild={true} variant="outline">
        <Link to={to} params={params} search={search}>
          {t("ui.common.action.backToOverview")}
        </Link>
      </Button>
    }
  />
);
