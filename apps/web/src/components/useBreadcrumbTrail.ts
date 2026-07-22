import { useMatches } from "@tanstack/react-router";
import { useActiveBuilding } from "../lib/activeBuilding";
import type { Crumb, CrumbEntry } from "../router";
import {
  isNavActive,
  kostenAbrechnungNav,
  stammdatenNav,
} from "./mainNavigation/navConfig";

/**
 * Gebäudegebundene Bereiche = die gescopten Nav-Gruppen
 */
const buildingScopedNav = [...stammdatenNav, ...kostenAbrechnungNav];

type ResolveContext = {
  params: Record<string, string>;
  loaderData: unknown;
  pathname: string;
};

const resolveCrumb = (crumb: Crumb, ctx: ResolveContext): CrumbEntry[] => {
  if (typeof crumb === "string") {
    return [{ label: crumb, to: ctx.pathname }];
  }

  const result = crumb(ctx);

  if (typeof result === "string") {
    return [{ label: result, to: ctx.pathname }];
  }

  return result;
};

/**
 * Vollständige Breadcrumb der aktuellen Route (allgemein -> spezifisch),
 * inklusive aktueller Seite als letztes Glied. Speist sowohl den Eyebrow
 * (ohne letztes Element) als auch den Browser-Tab-Titel.
 */
export const useBreadcrumbTrail = (): CrumbEntry[] => {
  const matches = useMatches();
  const { building } = useActiveBuilding();
  const entries: CrumbEntry[] = [];

  // Auf gebäudeabhängigen Seiten das aktive Gebäude als erste Crumb voranstellen.
  const pathname = matches.at(-1)?.pathname ?? "";
  const isBuildingScoped = buildingScopedNav.some((item) =>
    isNavActive(item, pathname),
  );

  if (isBuildingScoped && building) {
    entries.push({ label: building.name, to: `/gebaeude/${building.id}` });
  }

  for (const match of matches) {
    const crumb = match.staticData?.crumb;
    if (!crumb) {
      continue;
    }
    // Während des Ladens (pendingComponent) ist loaderData noch nicht da;
    // Crumb-Funktionen, die darauf zugreifen, dürfen die Kette nicht sprengen.
    // Als Platzhalter ein leeres Glied setzen, damit die aktuelle Seite ihren
    // Platz am Ende behält (der Eyebrow ist die Kette ohne dieses Glied).
    try {
      entries.push(
        ...resolveCrumb(crumb, {
          params: match.params as Record<string, string>,
          loaderData: match.loaderData,
          pathname: match.pathname,
        }),
      );
    } catch {
      entries.push({ label: "", to: match.pathname });
    }
  }

  return entries;
};
