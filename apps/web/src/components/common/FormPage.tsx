import type { ReactNode } from "react";
import { PageHead } from "./PageHead";

/**
 * Einheitlicher Rahmen für Create-/Edit-Formularseiten:
 * `PageHead` plus optionale Beschreibung als Sub-Zeile.
 */
export const FormPage = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <div className="space-y-6">
    <PageHead title={title} sub={description} />
    {children}
  </div>
);
