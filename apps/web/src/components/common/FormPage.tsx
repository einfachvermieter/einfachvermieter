import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";

/**
 * Einheitlicher Rahmen für Create-/Edit-Formularseiten: der Seitenkopf mit
 * Icon-Kachel, Breadcrumb-Eyebrow und Titel plus optionale Beschreibung als
 * Unterzeile. Detailseiten bestehender Entitäten übergeben stattdessen ihren
 * fertigen Kopf als `head`. Unten bleibt Platz für die Savebar.
 */
export const FormPage = ({
  tile,
  title,
  description,
  head,
  aside,
  children,
}: {
  /**
   * PageHeaderIcon mit dem Icon des Menüpunkts
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

  /**
   * Karten der rechten Infospalte (320 px, ab xl). Ohne `aside` bleibt das
   * Formular einspaltig.
   */
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <div className="pb-24">
    {head ??
      (title ? (
        <PageHeader tile={tile} title={title} sub={description} />
      ) : null)}
    {aside ? (
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] *:min-w-0">
        <div className="space-y-5">{children}</div>
        <div className="flex flex-col gap-6 xl:sticky xl:top-24">{aside}</div>
      </div>
    ) : (
      <div className="space-y-5">{children}</div>
    )}
  </div>
);
