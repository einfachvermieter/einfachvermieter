import type { ReactNode } from "react";
import { FormSkeleton } from "../FormSkeleton";
import { PageHeader } from "./PageHeader";

/**
 * Ladeansicht einer Detailseite (Route-`pendingComponent`): der Seitenkopf als
 * Skeleton-Variante (Kachel + Breadcrumb stehen, Titel/Unterzeile/Kennzahlen
 * als Skeleton) plus die Formular-Körper-Karte. So bleibt der Kopf beim
 * Übergang zur geladenen Seite an fester Position.
 */
export const DetailPending = ({
  tile,
  statsSkeleton,
  rows = 4,
}: {
  /**
   * Statische Domänen-Kachel (Name/Typ sind beim Laden noch unbekannt)
   */
  tile: ReactNode;
  statsSkeleton?: number;
  rows?: number;
}) => (
  <div className="pb-24">
    <PageHeader
      tile={tile}
      title=""
      loading={true}
      statsSkeleton={statsSkeleton}
    />
    <FormSkeleton rows={rows} />
  </div>
);
