import type { ReactNode } from "react";
import { PageHead } from "./PageHead";

/**
 * Einheitlicher Rahmen für Create-/Edit-Formularseiten: `PageHead` mit
 * Gruppenlabel (Eyebrow) plus optionale Beschreibung als Sub-Zeile.
 * Detailseiten bestehender Entitäten übergeben stattdessen ihr `HeroBand`
 * als `head` (Header-Regel: Liste = Eyebrow-Kopf, Ding = Hero).
 */
export const FormPage = ({
  eyebrow,
  title,
  description,
  head,
  children,
}: {
  eyebrow?: string;

  /**
   * Pflicht, sofern kein `head` übergeben wird
   */
  title?: string;
  description?: ReactNode;

  /**
   * Ersetzt den PageHead komplett, z. B. durch ein HeroBand
   */
  head?: ReactNode;
  children: ReactNode;
}) => (
  <div className="space-y-6">
    {head ??
      (title ? (
        <PageHead eyebrow={eyebrow} title={title} sub={description} />
      ) : null)}
    {children}
  </div>
);
