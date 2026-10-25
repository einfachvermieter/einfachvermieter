import { Skeleton } from "./ui/Skeleton";

/**
 * Abschnitt als Platzhalter: Titel mit Linie, darunter Wertezeilen
 * (Beschriftung links, Wert rechts) wie in SectionCard und ResultRows
 */
const SectionSkeleton = ({ rows }: { rows: number }) => (
  <div className="max-w-205">
    <div className="flex items-center gap-4">
      <Skeleton className="h-5 w-40" />
      <div className="h-0.5 flex-1 bg-border" />
    </div>
    <div className="mt-3">
      {Array.from({ length: rows }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: statischer Platzhalter
          key={index}
          className="flex items-center justify-between gap-6 border-t border-border py-3 first:border-t-0"
        >
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Platzhalter für den Inhalt unter dem Seitenkopf. Der Kopf wird separat
 * gerendert und bleibt beim Laden stehen.
 *
 * `aside` wird nicht mehr gezeichnet: Detailseiten sind einspaltig
 * `tabs` Tabs als Segmente über dem Inhalt
 * `kpis` Anzahl Kennzahlen über dem Inhalt (Abrechnungs-Detail)
 */
export const FormSkeleton = ({
  rows = 4,
  tabs,
  kpis = 0,
}: {
  rows?: number;
  aside?: boolean;
  tabs?: "default" | "pills";
  kpis?: number;
}) => (
  <div className="flex flex-col gap-10">
    {tabs ? (
      <div className="flex">
        {Array.from({ length: 4 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: statischer Platzhalter
          <Skeleton key={index} className="-ml-px h-8.5 w-28 first:ml-0" />
        ))}
      </div>
    ) : null}
    {kpis > 0 ? (
      <div className="flex max-w-205 gap-6">
        {Array.from({ length: kpis }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: statischer Platzhalter
            key={index}
            className="flex-1 border-l-2 border-border pl-3"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-1.5 h-5 w-24" />
          </div>
        ))}
      </div>
    ) : null}
    <SectionSkeleton rows={rows} />
    <SectionSkeleton rows={Math.max(2, rows - 2)} />
  </div>
);
