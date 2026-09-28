import { RiArrowRightSLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { useBreadcrumbTrail } from "../useBreadcrumbTrail";

/**
 * Pfad der aktuellen Seite in der Mac-Titelleiste, aktuelle Seite hell
 * hervorgehoben. Der Seitenkopf lässt seinen eigenen Pfad dann weg.
 */
export const DesktopBreadcrumb = () => {
  const trail = useBreadcrumbTrail().filter((entry) => entry.label.length > 0);

  return (
    <nav className="flex min-w-0 items-center gap-1.5 pl-2.5 text-schiefer-400">
      {trail.map((entry, index) => (
        <Fragment key={entry.to ?? entry.label}>
          {index > 0 ? (
            <RiArrowRightSLine className="size-3.5 shrink-0 text-schiefer-600" />
          ) : null}
          {entry.to && index < trail.length - 1 ? (
            <Link
              to={entry.to}
              className="truncate transition-colors hover:text-schiefer-50"
            >
              {entry.label}
            </Link>
          ) : (
            <span
              className={cn(
                "truncate",
                index === trail.length - 1 && "font-semibold text-schiefer-50",
              )}
            >
              {entry.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
};
