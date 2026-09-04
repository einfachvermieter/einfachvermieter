import { type RemixiconComponentType, RiPencilLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
import { t } from "../../../lib/i18n";

/**
 * View-Card der Zähler-Stammdaten
 */
export const MeterViewCard = ({
  icon,
  title,
  titleHelp,
  description,
  rows,
  onEdit,
  children,
}: {
  icon: RemixiconComponentType;
  title: string;
  titleHelp?: ReactNode;
  description?: string;
  rows: { label: ReactNode; value: ReactNode }[];
  onEdit: () => void;
  children?: ReactNode;
}) => (
  <SectionCard
    icon={icon}
    title={title}
    titleExtra={titleHelp}
    description={description}
    action={
      <Button type="button" variant="addLink" size="text" onClick={onEdit}>
        <RiPencilLine />
        {t("ui.common.action.edit")}
      </Button>
    }
  >
    <ResultRows rows={rows} />
    {children}
  </SectionCard>
);
