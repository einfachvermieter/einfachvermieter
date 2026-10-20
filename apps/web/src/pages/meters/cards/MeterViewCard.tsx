import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionAction } from "@/components/common/SectionAction";
import { SectionCard } from "@/components/common/SectionCard";
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
      <SectionAction
        kind="edit"
        label={t("ui.common.action.edit")}
        onClick={onEdit}
      />
    }
  >
    <ResultRows rows={rows} />
    {children}
  </SectionCard>
);
