import { formatDate } from "@einfachvermieter/shared";
import type { ReactNode } from "react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionAction } from "@/components/common/SectionAction";
import { SectionCard } from "@/components/common/SectionCard";
import { IconReceipt } from "@/lib/icons";
import type { CostEntryDetail } from "../../../lib/costs";
import { t } from "../../../lib/i18n";

/**
 * View-Card der Rechnungs-Basisdaten
 */
export const CostEntryBaseCard = ({
  entry,
  statements,
  onEdit,
}: {
  entry: CostEntryDetail;

  /**
   * Abrechnungen, in die die Rechnung einfließt (Links), oder ein Hinweis,
   * dass es noch keine gibt
   */
  statements: ReactNode;
  onEdit: () => void;
}) => {
  const dash = t("ui.common.emptyValue");

  return (
    <SectionCard
      icon={IconReceipt}
      title={t("ui.invoices.detail.basicsSection")}
      action={
        <SectionAction
          kind="edit"
          label={t("ui.common.action.edit")}
          onClick={onEdit}
        />
      }
    >
      <ResultRows
        rows={[
          {
            label: t("ui.common.columns.invoiceDate"),
            value: formatDate(entry.invoiceDate),
          },
          {
            label: t("ui.costs.columns.vendor"),
            value: entry.vendor ?? dash,
          },
          {
            label: t("ui.costs.entryFields.invoiceNumber"),
            value: entry.invoiceNumber ?? dash,
          },
          {
            label: t("ui.invoices.detail.statementsHint"),
            value: statements,
          },
        ]}
      />
    </SectionCard>
  );
};
