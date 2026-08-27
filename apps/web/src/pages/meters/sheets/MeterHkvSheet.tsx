import type { MeterFormValues } from "@einfachvermieter/shared";
import { meterFormSchema } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiFireLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { t } from "../../../lib/i18n";
import { HkvFields } from "../components/hkv/HkvFields";

/**
 * Heizkostenverteiler-Angaben (Heizkörper, KGesamt) im FormSheet
 */
export const MeterHkvSheet = ({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues: MeterFormValues;
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
      icon={RiFireLine}
      title={t("ui.meters.detail.hkvSection")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <HkvFields form={form} />
    </FormSheet>
  );
};
