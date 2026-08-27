import { Card, CardContent } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

/**
 * Platzhalter für den Formular-Body (Card mit Feldzeilen). Der Seitenkopf
 * wird separat gerendert und bleibt beim Laden stehen, damit Kachel und
 * Breadcrumb nicht springen.
 *
 * `aside` rechte Sidebar als Skeleton ja/nein
 * `tabs` Tabs in Skeleton entweder als Pills oder Switches, je nach Seite
 * `kpis` Anzahl Kennzahl-Kacheln über dem Body (Abrechnungs-Detail)
 */
export const FormSkeleton = ({
  rows = 4,
  aside = false,
  tabs,
  kpis = 0,
}: {
  rows?: number;
  aside?: boolean;
  tabs?: "default" | "pills";
  kpis?: number;
}) => {
  const card = (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: statischer Platzhalter
          <div key={index} className="flex flex-col gap-4">
            <Skeleton className="h-5 max-w-50" />
            <Skeleton className="h-9" />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const body =
    kpis > 0 ? (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: kpis }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: statischer Platzhalter
            <Skeleton key={index} className="h-21 rounded-lg" />
          ))}
        </div>
        {card}
      </div>
    ) : (
      card
    );

  const main =
    tabs === "pills" ? (
      <div className="flex flex-col gap-2">
        <div className="mb-2.5 flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: statischer Platzhalter
            <Skeleton key={index} className="h-8.75 w-24 rounded-full" />
          ))}
        </div>
        {body}
      </div>
    ) : (
      body
    );

  const content = aside ? (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] *:min-w-0">
      {main}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-5 max-w-50" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </CardContent>
      </Card>
    </div>
  ) : (
    main
  );

  if (tabs !== "default") {
    return content;
  }

  return (
    <div>
      <Skeleton className="h-11 w-64 rounded-lg" />
      <div className="mt-6">{content}</div>
    </div>
  );
};
