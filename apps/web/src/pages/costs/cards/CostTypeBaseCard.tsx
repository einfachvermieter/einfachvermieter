import { RiPencilLine } from "@remixicon/react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
import {
  type CostTypeDetail,
  costTypeAllocationText,
  costTypeCategoryLabel,
  laborCostCategoryLabel,
} from "../../../lib/costs";
import { costTypeVisual } from "../../../lib/domainVisuals";
import { t } from "../../../lib/i18n";

/**
 * View-Card der Kostenart-Stammdaten
 */
export const CostTypeBaseCard = ({
  costType,
  onEdit,
}: {
  costType: CostTypeDetail;
  onEdit: () => void;
}) => {
  const isHeating = costType.category === "heating";
  const yesNo = (value: boolean) => (value ? t("common.yes") : t("common.no"));

  return (
    <SectionCard
      icon={costTypeVisual(costType).icon}
      title={t("ui.costs.detail.sectionTitle")}
      action={
        <Button type="button" variant="addLink" size="text" onClick={onEdit}>
          <RiPencilLine />
          {t("ui.common.action.edit")}
        </Button>
      }
    >
      <ResultRows
        rows={[
          { label: t("ui.common.columns.name"), value: costType.name },
          {
            label: t("ui.costs.columns.category"),
            value: costTypeCategoryLabel(costType.category),
          },
          ...(isHeating
            ? []
            : [
                {
                  label: t("ui.common.columns.allocation"),
                  value: costTypeAllocationText(costType),
                },
              ]),
          {
            label: t("ui.costs.typeFields.laborCostCategory"),
            value: costType.laborCostCategory
              ? laborCostCategoryLabel(costType.laborCostCategory)
              : t("ui.costs.laborCostCategoryOptions.__none__"),
          },
          ...(isHeating
            ? [
                {
                  label: t("ui.costs.detail.co2Row"),
                  value: yesNo(costType.co2Tracked),
                },
                {
                  label: t("ui.costs.typeFields.isMeteringServiceCost"),
                  value: yesNo(costType.isMeteringServiceCost),
                },
              ]
            : []),
        ]}
      />
    </SectionCard>
  );
};
