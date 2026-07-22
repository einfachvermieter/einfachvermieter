import { Card, CardContent } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

/**
 * Platzhalter für den Formular-Body (Karte mit Feldzeilen). Der Seitenkopf
 * wird separat gerendert und bleibt beim Laden stehen, damit Kachel und
 * Breadcrumb nicht springen.
 */
export const FormSkeleton = ({ rows = 4 }: { rows?: number }) => (
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
