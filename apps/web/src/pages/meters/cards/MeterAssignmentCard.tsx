import {
  RiFireLine,
  RiPencilLine,
  RiPieChart2Line,
  RiPriceTag3Line,
} from "@remixicon/react";
import { ResultRows } from "@/components/common/ResultRows";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
import { t } from "../../../lib/i18n";
import type { Meter } from "../../../lib/meters";

/**
 * View-Card der Kostenzuordnung
 */
export const MeterAssignmentCard = ({
  meter,
  costTypes,
  onEdit,
}: {
  meter: Meter;
  costTypes: { id: string; name: string; allocation: string }[];
  onEdit: () => void;
}) => {
  const isHeatingBill = meter.costAllocationMode === "heating_cost_bill";
  const ModeIcon = isHeatingBill ? RiFireLine : RiPieChart2Line;
  const modeKey = isHeatingBill ? "heatingCostBill" : "costTypes";

  return (
    <SectionCard
      icon={RiPriceTag3Line}
      title={t("ui.meters.detail.assignmentSection")}
      description={t("ui.meters.detail.assignmentDescription")}
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
            label: t("ui.meters.detail.assignmentModeLabel"),
            value: (
              <span className="flex flex-col items-end gap-0.5">
                <span className="inline-flex items-center gap-2">
                  <ModeIcon
                    aria-hidden={true}
                    className="size-4.25 shrink-0 text-muted-foreground"
                  />
                  {t(`ui.meters.costAllocationMode.${modeKey}.title`)}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {t(`ui.meters.costAllocationMode.${modeKey}.description`)}
                </span>
              </span>
            ),
          },
          ...(isHeatingBill
            ? []
            : [
                {
                  label: t("ui.meters.detail.usedForCostTypes"),
                  value:
                    costTypes.length > 0 ? (
                      <span className="flex flex-col items-end gap-1.5">
                        {costTypes.map((costType) => (
                          <span
                            key={costType.id}
                            className="flex flex-col items-end"
                          >
                            {costType.name}
                            <span className="text-sm font-normal text-muted-foreground">
                              {costType.allocation}
                            </span>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        {t("ui.meters.detail.noCostTypes")}
                      </span>
                    ),
                },
              ]),
        ]}
      />
    </SectionCard>
  );
};
