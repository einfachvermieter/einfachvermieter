import type { MeterFormValues } from "@einfachvermieter/shared";
import { meterFormSchema } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiPriceTag3Line } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import type { CostType } from "../../../lib/costs";
import { t } from "../../../lib/i18n";
import { CostAllocationModeField } from "../components/costAssignment/CostAllocationModeField";
import { CostTypeAssignment } from "../components/costAssignment/CostTypeAssignment";

/**
 * Kostenzuordnung eines Zählers im FormSheet
 */
export const MeterAssignmentSheet = ({
  costTypes,
  defaultValues,
  locked,
  onSubmit,
  onClose,
}: {
  costTypes: CostType[];
  defaultValues: MeterFormValues;

  /**
   * Modus ist festgeschrieben (bereits abgerechnete Zeiträume)
   */
  locked: boolean;
  onSubmit: (values: MeterFormValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<MeterFormValues>({
    resolver: zodResolver(meterFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const costAllocationMode = form.watch("costAllocationMode");

  return (
    <FormSheet
      form={form}
      icon={RiPriceTag3Line}
      title={t("ui.meters.detail.assignmentSection")}
      description={t("ui.meters.detail.assignmentDescription")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <CostAllocationModeField form={form} locked={locked} />
      {costAllocationMode === "cost_types" ? (
        <CostTypeAssignment form={form} costTypes={costTypes} />
      ) : null}
    </FormSheet>
  );
};
