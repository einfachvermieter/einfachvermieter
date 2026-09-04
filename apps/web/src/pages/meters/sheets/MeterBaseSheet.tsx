import type { MeterFormValues } from "@einfachvermieter/shared";
import { meterFormSchema } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiDashboard2Line } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { t } from "../../../lib/i18n";
import type { Unit } from "../../../lib/units";
import { MeterBaseFields } from "../components/baseData/MeterBaseFields";

/**
 * Stammdaten eines Zählers im FormSheet bearbeiten. Arbeitet auf den
 * kompletten Formularwerten, damit die abhängigen Felder (Rolle, Wohnung,
 * Typ-Wechsel) zusammenspielen.
 */
export const MeterBaseSheet = ({
  units,
  defaultValues,
  onSubmit,
  onClose,
}: {
  units: Unit[];
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
      icon={RiDashboard2Line}
      title={t("ui.meters.detail.baseSection")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <MeterBaseFields form={form} units={units} variant="sheet" />
    </FormSheet>
  );
};
