import { zodResolver } from "@hookform/resolvers/zod";
import { RiReceiptLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { t } from "../../../lib/i18n";
import { CostEntryBaseFields } from "../components/baseData/CostEntryBaseFields";
import {
  type CostEntryFormValues,
  costEntryFormSchema,
} from "../components/baseData/costEntryForm.schema";

/**
 * Basisdaten der Rechnung im FormSheet. Arbeitet auf den kompletten
 * Formularwerten, damit die Positionen beim Speichern erhalten bleiben.
 */
export const CostEntryBaseSheet = ({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues: CostEntryFormValues;
  onSubmit: (values: CostEntryFormValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<CostEntryFormValues>({
    resolver: zodResolver(costEntryFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiReceiptLine}
      title={t("ui.invoices.detail.basicsSection")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <CostEntryBaseFields form={form} />
    </FormSheet>
  );
};
