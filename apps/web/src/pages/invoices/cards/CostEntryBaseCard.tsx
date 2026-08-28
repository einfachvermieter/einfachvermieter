import { formatDate } from "@einfachvermieter/shared";
import { RiPencilLine, RiReceiptLine } from "@remixicon/react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
import type { CostEntryDetail } from "../../../lib/costs";
import { t } from "../../../lib/i18n";

/**
 * View-Card der Rechnungs-Basisdaten
 */
export const CostEntryBaseCard = ({
  entry,
  onEdit,
}: {
  entry: CostEntryDetail;
  onEdit: () => void;
}) => {
  const dash = t("ui.common.emptyValue");

  return (
    <SectionCard
      icon={RiReceiptLine}
      title={t("ui.invoices.detail.basicsSection")}
      action={
        <Button type="button" variant="addLink" size="text" onClick={onEdit}>
          <RiPencilLine />
          {t("ui.common.action.edit")}
        </Button>
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
        ]}
      />
    </SectionCard>
  );
};
