import type { ReactNode } from "react";
import { Description } from "./Description";
import { Heading1 } from "./Heading1";

/**
 * Einheitlicher Rahmen für Create-/Edit-Formularseiten: vertikaler Abstand
 * plus `Heading1` mit Icon, optional gefolgt von einer `Description` direkt
 * unter dem Titel.
 */
export const FormPage = ({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <div className="space-y-6">
    {description ? (
      <div className="space-y-2">
        <Heading1 icon={icon}>{title}</Heading1>
        <Description>{description}</Description>
      </div>
    ) : (
      <Heading1 icon={icon}>{title}</Heading1>
    )}
    {children}
  </div>
);
