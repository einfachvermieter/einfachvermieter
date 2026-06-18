import type { MeterFormValues } from "@einfachvermieter/shared";
import { RiFireLine, RiPieChart2Line } from "@remixicon/react";
import type { UseFormReturn } from "react-hook-form";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { t } from "../../../../lib/i18n";

export const CostAllocationModeField = ({
  form,
  locked = false,
}: {
  form: UseFormReturn<MeterFormValues>;
  locked?: boolean;
}) => {
  const current = form.watch("costAllocationMode");
  return (
    <div className="flex flex-col gap-3">
      <ChoiceTilesInput
        control={form.control}
        name="costAllocationMode"
        options={[
          {
            value: "cost_types",
            icon: RiPieChart2Line,
            title: t("ui.meters.costAllocationMode.costTypes.title"),
            description: t(
              "ui.meters.costAllocationMode.costTypes.description",
            ),
            disabled: locked && current !== "cost_types",
          },
          {
            value: "heating_cost_bill",
            icon: RiFireLine,
            title: t("ui.meters.costAllocationMode.heatingCostBill.title"),
            description: t(
              "ui.meters.costAllocationMode.heatingCostBill.description",
            ),
            disabled: locked && current !== "heating_cost_bill",
          },
        ]}
      />
      {locked ? (
        <p className="text-sm text-muted-foreground">
          {t("ui.meters.costAllocationMode.lockedHint")}
        </p>
      ) : null}
    </div>
  );
};
