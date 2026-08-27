import type { MeterFormValues } from "@einfachvermieter/shared";
import { meterFormSchema } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiSubtractLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { t } from "../../../lib/i18n";
import { DifferenceConfigFields } from "../components/differenceConfig/DifferenceConfigFields";

/**
 * Quellen eines Differenzzählers (Basiszähler minus Abzugszähler)
 */
export const MeterDifferenceSheet = ({
  defaultValues,
  currentMeterId,
  onSubmit,
  onClose,
}: {
  defaultValues: MeterFormValues;
  currentMeterId: string;
  onSubmit: (values: MeterFormValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<MeterFormValues>({
    resolver: zodResolver(meterFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiSubtractLine}
      title={t("ui.meters.differenceConfig.title")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <DifferenceConfigFields form={form} currentMeterId={currentMeterId} />
    </FormSheet>
  );
};
