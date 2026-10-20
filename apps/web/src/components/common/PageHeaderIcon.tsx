import { type DomainKey, domainVisuals } from "../../lib/domainVisuals";

/**
 * Bild im Seitenkopf: die Illustration des Bereichs
 */
export const PageHeaderIcon = ({ domain }: { domain: DomainKey }) => {
  const { art: Art } = domainVisuals[domain];
  return <Art className="size-13 shrink-0 text-foreground" />;
};
