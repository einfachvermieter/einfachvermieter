import {
  type HeatingFormValues,
  heatingFormSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiPercentLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { t } from "../../../lib/i18n";
import { HeatingBillingFields } from "../components/settings/HeatingBillingFields";

/**
 * Abrechnung der Heizkosten-Konfiguration bearbeiten. Das Formular hält
 * den kompletten Wertesatz, zeigt aber nur die Abrechnungs-Felder.
 */
export const HeatingBillingSheet = ({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues: HeatingFormValues;
  onSubmit: (values: HeatingFormValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<HeatingFormValues>({
    resolver: zodResolver(heatingFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiPercentLine}
      title={t("ui.heating.cards.billing")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <HeatingBillingFields form={form} />
    </FormSheet>
  );
};
