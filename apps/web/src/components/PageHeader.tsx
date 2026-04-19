import type { ReactNode } from "react";
import { Heading1 } from "@/components/common/Heading1";

export const PageHeader = ({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
}) => (
  <div className="flex justify-between items-start min-h-10">
    <Heading1 icon={icon}>{title}</Heading1>
    {action}
  </div>
);
