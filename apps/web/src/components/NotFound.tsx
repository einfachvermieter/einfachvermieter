import { RiFileUnknowLine } from "@remixicon/react";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/Empty";

export const NotFound = ({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiFileUnknowLine />
      </EmptyMedia>

      <EmptyTitle>{title}</EmptyTitle>

      {description ? <EmptyDescription>{description}</EmptyDescription> : null}
    </EmptyHeader>
    {action ? <EmptyContent>{action}</EmptyContent> : null}
  </Empty>
);
