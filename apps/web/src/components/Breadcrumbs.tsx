import { Link, useMatches } from "@tanstack/react-router";
import { Fragment, useEffect } from "react";
import { useActiveBuilding } from "../lib/activeBuilding";
import type { Crumb, CrumbEntry } from "../router";
import {
  isNavActive,
  kostenAbrechnungNav,
  stammdatenNav,
} from "./mainNavigation/navConfig";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/Breadcrumb";

// Gebäudegebundene Bereiche = die gescopten Nav-Gruppen (eine Quelle: navConfig).
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

const renderEntry = (entry: CrumbEntry, isCurrent: boolean) => {
  if (entry.to && !isCurrent) {
    return (
      <BreadcrumbLink asChild={true}>
        <Link to={entry.to}>{entry.label}</Link>
      </BreadcrumbLink>
    );
  }
  return <BreadcrumbPage>{entry.label}</BreadcrumbPage>;
};

export const Breadcrumbs = () => {
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
    entries.push(
      ...resolveCrumb(crumb, {
        params: match.params as Record<string, string>,
        loaderData: match.loaderData,
        pathname: match.pathname,
      }),
    );
  }

  const visible = entries.filter((entry) => entry.label.length > 0);

  // Der Browser-Tab-Titel ist die komplette Breadcrumb-Kette in umgekehrter
  // Reihenfolge (spezifisch -> allgemein), abgeschlossen mit dem Markennamen.
  // Die Breadcrumb zeigt die Kette inklusive aktueller Seite; das letzte
  // Glied ist nicht verlinkt.
  const titleTrail = [...visible].reverse().map((entry) => entry.label);
  const documentTitle = [...titleTrail, "EinfachVermieter"].join(" – ");
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  if (visible.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {visible.map((entry, index, all) => {
          const isLast = index === all.length - 1;
          return (
            <Fragment key={entry.to ?? entry.label}>
              <BreadcrumbItem>{renderEntry(entry, isLast)}</BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
