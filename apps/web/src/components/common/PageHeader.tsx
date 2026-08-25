import { RiArrowRightSLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useBreadcrumbTrail } from "../useBreadcrumbTrail";

/**
 * Einheitlicher Seitenkopf für Listen- und Detailseiten: Icon bzw. Avatar,
 * Breadcrumb-Eyebrow, Titel, Unterzeile und rechts entweder ein
 * Primärbutton (Listen) oder Kennzahlen (Detail).
 */
export const PageHeader = ({
  tile,
  title,
  sub,
  loading = false,
  subLoading = false,
  stats,
  statsSkeleton,
  action,
  breadcrumb = true,
}: {
  /**
   * PageHeaderIcon oder InitialsAvatar in Größe 44
   */
  tile: ReactNode;
  title: string;
  sub?: ReactNode;

  /**
   * Detaildaten laden noch: Titel, Unterzeile und Kennzahlen als Skeleton
   *
   */
  loading?: boolean;

  /**
   * Nur die Unterzeile lädt noch (Listen); zeigt dort einen Skeleton-Balken
   */
  subLoading?: boolean;
  stats?: { label: string; value: ReactNode }[];

  /**
   * Anzahl der Kennzahl-Platzhalter, solange `loading` gilt
   */
  statsSkeleton?: number;

  /**
   * Aktions-Buttons rechts (z. B. Hinzufügen/Finalisieren)
   */
  action?: ReactNode;

  /**
   * Breadcrumb-Eyebrow ausblenden (z. B. Einstellungen mit eigener Reiter-Navigation)
   */
  breadcrumb?: boolean;
}) => {
  // Der Eyebrow ist Breadcrumb: die volle Kette ohne die aktuelle Seite,
  // die selbst als Titel erscheint.
  const trail = useBreadcrumbTrail();
  const ancestors = breadcrumb
    ? trail.slice(0, -1).filter((entry) => entry.label.length > 0)
    : [];
  const statsSkeletonKeys = Array.from(
    { length: loading ? (statsSkeleton ?? 0) : 0 },
    (_, index) => `stat-skeleton-${index}`,
  );

  return (
    <header
      className={cn(
        "mb-5.5 pb-6.5",
        ancestors.length > 0 ? "pt-0.5" : "pt-3.5",
      )}
    >
      {ancestors.length > 0 ? (
        <nav className="mb-4 flex flex-wrap items-center gap-1.75 text-xs leading-4 font-semibold tracking-[0.005em] text-slate-400">
          {ancestors.map((entry, index) => (
            <Fragment key={entry.to ?? entry.label}>
              {index > 0 ? (
                <RiArrowRightSLine className="size-3.5 shrink-0 opacity-70" />
              ) : null}
              {entry.to ? (
                <Link
                  to={entry.to}
                  className="text-sky-700 transition-colors hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  {entry.label}
                </Link>
              ) : (
                <span>{entry.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      ) : null}

      <div className="flex items-center gap-4 max-lg:flex-wrap sm:gap-5.5">
        <div className="shrink-0">{tile}</div>

        <div className="min-w-0 flex-1">
          {loading ? (
            // Höhe der geladenen h1-Zeile reservieren,
            // damit die mittig ausgerichtete Kachel nicht springt
            <div className="flex h-7.5 items-center">
              <Skeleton className="h-5 w-56 bg-slate-400/15" />
            </div>
          ) : (
            <h1 className="text-2xl leading-tight font-semibold">{title}</h1>
          )}
          {/* Zeile immer reservieren, damit nachladende Unterzeilen die
              Kopfhöhe nicht springen lassen */}
          <div className="mt-0.75 flex min-h-4 items-center text-xs leading-4 font-medium text-slate-400">
            {loading || subLoading ? (
              <Skeleton className="h-3.5 w-56 bg-slate-400/15" />
            ) : (
              sub
            )}
          </div>
        </div>

        {statsSkeletonKeys.length > 0 ? (
          <div className="ml-auto flex max-lg:ml-0 max-lg:w-full max-lg:justify-between max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-3">
            {statsSkeletonKeys.map((key) => (
              <div
                key={key}
                className="border-l border-border px-4 text-right first:border-l-0 last:pr-0 max-lg:first:pl-0 sm:px-5 max-sm:border-l-0 max-sm:px-0"
              >
                <Skeleton className="ml-auto h-3 w-16 bg-slate-400/15" />
                <Skeleton className="mt-1.5 ml-auto h-5 w-20 bg-slate-400/15" />
              </div>
            ))}
          </div>
        ) : null}

        {statsSkeletonKeys.length === 0 && stats && stats.length > 0 ? (
          <div className="ml-auto flex max-lg:ml-0 max-lg:w-full max-lg:justify-between max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="border-l border-border px-4 text-right first:border-l-0 last:pr-0 max-lg:first:pl-0 sm:px-5 max-sm:border-l-0 max-sm:px-0"
              >
                <div className="text-[11.5px] leading-3.75 font-semibold text-slate-400">
                  {stat.label}
                </div>
                <div className="mt-0.75 text-[19px] leading-[1.29] font-semibold tracking-[-0.02em] tabular-nums">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {action ? (
          <div
            className={cn(
              "flex shrink-0 items-center gap-2 **:data-[slot=button]:shadow-none",
              !(stats && stats.length > 0) && "ml-auto",
            )}
          >
            {action}
          </div>
        ) : null}
      </div>
    </header>
  );
};
