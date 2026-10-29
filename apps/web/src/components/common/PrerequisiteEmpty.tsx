import { t } from "../../lib/i18n";
import {
  type GatedDomain,
  NEEDS_META,
  PREREQUISITES,
  usePrerequisite,
} from "../../lib/prerequisites";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/Empty";
import { DomainLink } from "./DomainLink";

/**
 * Großer Leer-Hinweis in Listen, deren Anlage-Voraussetzung fürs aktive
 * Gebäude fehlt. Verlinkt auf die Liste der ersten fehlenden Entität.
 */
export const PrerequisiteEmpty = ({ domain }: { domain: GatedDomain }) => {
  const { missing } = usePrerequisite(domain);
  const needs = missing ?? PREREQUISITES[domain][0];
  const { linkTo, icon: Icon } = NEEDS_META[needs];

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{t(`ui.prerequisites.${needs}.title`)}</EmptyTitle>
        <EmptyDescription>
          {t(`ui.prerequisites.descriptions.${domain}.${needs}`)}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {/* Ein Verweis in einen anderen Bereich, keine Aktion: daher ein
            Textlink statt eines Buttons */}
        <DomainLink to={linkTo}>
          {t(`ui.prerequisites.${needs}.action`)}
        </DomainLink>
      </EmptyContent>
    </Empty>
  );
};
