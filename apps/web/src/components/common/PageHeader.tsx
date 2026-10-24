import { RiArrowRightSLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useBreadcrumbTrail } from "../useBreadcrumbTrail";

/**
 * Unterzeile: eine Liste steht mit Abstand nebeneinander, ohne Trennzeichen
 */
const renderSub = (sub: ReactNode | ReactNode[]): ReactNode =>
  Array.isArray(sub) ? (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
      {sub.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: feste Reihenfolge
        <span key={index}>{item}</span>
      ))}
    </span>
  ) : (
    sub
  );

/**
 * Einheitlicher Seitenkopf für Listen- und Detailseiten: Titel-Tile,
 * Titel (auf Detailseiten mit dem Bereich als Link davor), Unterzeile und
 * rechts die Befehle der Seite, die Haupttaste ganz außen.
 */
export const PageHeader = ({
  tile,
  title,
  titleShort,
  titleExtra,
  sub,
  loading = false,
  subLoading = false,
  stats,
  statsSkeleton,
  action,
  breadcrumb = true,
}: {
  /**
   * PageHeaderIcon mit dem Icon des Menüpunkts
   */
  tile: ReactNode;
  title: string;

  /**
   * Kürzere Fassung des Titels für schmale Fenster, z. B. mit abgekürzten
   * Vornamen
   */
  titleShort?: string;

  /**
   * Zusatz neben dem Titel, z.B. Status-Badge
   */
  titleExtra?: ReactNode;
  /**
   * Unterzeile. Eine Liste wird mit Abstand nebeneinander gesetzt, ohne
   * Trennzeichen
   */
  sub?: ReactNode | ReactNode[];

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
   * Bereich vor dem Titel ausblenden (z.B. Einstellungen mit eigener
   * Tabs-Navigation)
   */
  breadcrumb?: boolean;
}) => {
  // Auf Detailseiten steht der Bereich als Link vor dem Namen des
  // Datensatzes, im Wortlaut der Sidebar. Er ist der Weg zurück zur Liste.
  // Brotkrumen gibt es nicht
  const trail = useBreadcrumbTrail();
  const area = breadcrumb
    ? trail
        .slice(0, -1)
        .filter((entry) => !entry.building && entry.label.length > 0)
        .at(-1)
    : undefined;
  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const scroller = headerRef.current?.closest<HTMLElement>(
      "[data-slot=sidebar-inset]",
    );
    if (!scroller) {
      return;
    }
    const sync = () => setScrolled(scroller.scrollTop > 0);
    sync();
    scroller.addEventListener("scroll", sync, { passive: true });
    return () => scroller.removeEventListener("scroll", sync);
  }, []);
  const statsSkeletonKeys = Array.from(
    { length: loading ? (statsSkeleton ?? 0) : 0 },
    (_, index) => `stat-skeleton-${index}`,
  );

  return (
    <header
      ref={headerRef}
      data-detail={area ? true : undefined}
      data-scrolled={area && scrolled ? true : undefined}
      className={cn(
        "mb-6 pt-1",
        // Detailseiten: der Kopf bleibt stehen, halb durchsichtig mit
        // Unschärfe. Die Linie erscheint erst, wenn Inhalt darunter liegt
        area && "sticky top-0 z-20 -mx-5 -mt-6 px-5 pt-7 pb-4",
      )}
    >
      {/* Auf Detailseiten so breit wie die Abschnitte, damit die Tasten mit
          der Inhaltskante abschließen */}
      <div
        className={cn(
          "flex items-center gap-3.25 max-lg:flex-wrap",
          area && "max-w-205",
        )}
      >
        <div className="shrink-0">{tile}</div>

        {/* Mindestbreite, damit die Buttons im schmalen Fenster in die
            nächste Zeile rutschen, statt den Titel abzuschneiden */}
        <div className="min-w-72 flex-1 max-sm:min-w-0">
          {loading ? (
            // Höhe der geladenen h1-Zeile reservieren,
            // damit das mittig ausgerichtete Tile nicht springt
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-56" />
            </div>
          ) : (
            <h1 className="flex items-center gap-2.5 font-heading text-2xl font-semibold tracking-heading">
              <span className="truncate">
                {area?.to ? (
                  <>
                    <Link
                      to={area.to}
                      className="font-normal text-muted-foreground underline-offset-4 hover:text-azur-700 hover:underline"
                    >
                      {area.label}
                    </Link>
                    <RiArrowRightSLine
                      aria-hidden={true}
                      className="mx-1 inline size-5 align-[-0.15em] text-schiefer-300"
                    />
                  </>
                ) : null}
                {titleShort ? (
                  <>
                    <span className="sm:hidden">{titleShort}</span>
                    <span className="max-sm:hidden">{title}</span>
                  </>
                ) : (
                  title
                )}
              </span>
              {titleExtra}
            </h1>
          )}
          {/* Zeile immer reservieren, damit nachladende Unterzeilen die
              Kopfhöhe nicht springen lassen */}
          <div className="mt-0.75 flex min-h-5 items-center text-sm text-muted-foreground">
            {loading || subLoading ? (
              <Skeleton className="h-3.5 w-56" />
            ) : (
              renderSub(sub)
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
                <Skeleton className="ml-auto h-4 w-16" />
                <Skeleton className="mt-0.5 ml-auto h-7 w-20" />
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
                <div className="text-xs text-muted-foreground">
                  {stat.label}
                </div>
                <div className="mt-0.5 font-heading text-lg font-semibold tracking-heading tabular-nums">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {action ? (
          <div
            className={cn(
              "flex shrink-0 items-center gap-2",
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
