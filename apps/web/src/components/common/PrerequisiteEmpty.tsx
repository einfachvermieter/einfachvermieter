import { Link } from "@tanstack/react-router";
import { t } from "../../lib/i18n";
import {
  type GatedDomain,
  NEEDS_META,
  PREREQUISITES,
} from "../../lib/prerequisites";
import { Button } from "../ui/Button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/Empty";

/**
 * Großer Leer-Hinweis in Listen, deren Anlage-Voraussetzung fürs aktive
 * Gebäude fehlt. Verlinkt auf die Liste der zuerst benötigten Entität.
 */
export const PrerequisiteEmpty = ({ domain }: { domain: GatedDomain }) => {
  const { needs } = PREREQUISITES[domain];
  const { linkTo, icon: Icon } = NEEDS_META[needs];

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{t(`ui.prerequisites.${needs}.title`)}</EmptyTitle>
        <EmptyDescription>
          {t(`ui.prerequisites.descriptions.${domain}`)}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild={true} variant="outline">
          <Link to={linkTo}>{t(`ui.prerequisites.${needs}.action`)}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
};
