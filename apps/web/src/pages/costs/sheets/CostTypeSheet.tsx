import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { costTypeVisual } from "../../../lib/domainVisuals";
import { t } from "../../../lib/i18n";
import { CostTypeBaseFields } from "../components/baseData/CostTypeBaseFields";
import {
  type CostTypeFormValues,
  type CostTypeSubmitValues,
  costTypeFormSchema,
  costTypeFormToDto,
} from "../components/baseData/costTypeForm.schema";

/**
 * Kostenart im FormSheet anlegen bzw. bearbeiten
 */
export const CostTypeSheet = ({
  mode,
  defaultValues,
  onSubmit,
  onClose,
}: {
  mode: "create" | "edit";
  defaultValues: CostTypeFormValues;
  onSubmit: (values: CostTypeSubmitValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<CostTypeFormValues>({
    resolver: zodResolver(costTypeFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={costTypeVisual(defaultValues).icon}
      title={
        mode === "create"
          ? t("ui.costs.typeCreateTitle")
          : t("ui.costs.detail.sectionTitle")
      }
      submitLabel={
        mode === "create"
          ? t("ui.common.action.create")
          : t("ui.common.action.save")
      }
      onSubmit={(values) => onSubmit(costTypeFormToDto(values))}
      onClose={onClose}
    >
      <CostTypeBaseFields form={form} />
    </FormSheet>
  );
};
