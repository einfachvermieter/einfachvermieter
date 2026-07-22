import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";

/**
 * Einheitlicher Rahmen für Create-/Edit-Formularseiten: der Seitenkopf mit
 * Icon-Kachel, Breadcrumb-Eyebrow und Titel plus optionale Beschreibung als
 * Unterzeile. Detailseiten bestehender Entitäten übergeben stattdessen ihren
 * fertigen Kopf als `head`.
 */
export const FormPage = ({
  tile,
  title,
  description,
  head,
  children,
}: {
  /**
   * IconTile oder InitialsAvatar in Größe 44
   */
  tile?: ReactNode;

  /**
   * Pflicht, sofern kein `head` übergeben wird
   */
  title?: string;
  description?: ReactNode;

  /**
   * Ersetzt den Kopf komplett, z. B. durch einen eigenen PageHeader
   */
  head?: ReactNode;
  children: ReactNode;
}) => (
  <div className="space-y-6">
    {head ??
      (title ? (
        <PageHeader tile={tile} title={title} sub={description} />
      ) : null)}
    {children}
  </div>
);
