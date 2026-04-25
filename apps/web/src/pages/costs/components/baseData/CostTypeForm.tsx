import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import type { Building } from "../../../../lib/buildings";
import { t } from "../../../../lib/i18n";
import { CostTypeBaseFields } from "./CostTypeBaseFields";
import {
  type CostTypeFormValues,
  type CostTypeSubmitValues,
  costTypeFormSchema,
  costTypeFormToDto,
} from "./costTypeForm.schema";

export const CostTypeForm = ({
  mode,
  buildings,
  defaultValues,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  buildings: Building[];
  defaultValues: CostTypeFormValues;
  onSubmit: (values: CostTypeSubmitValues) => Promise<void>;
  onCancel: () => void;
}) => {
  const form = useForm<CostTypeFormValues>({
    resolver: zodResolver(costTypeFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;

  return (
    <Form
      form={form}
      onSubmit={(values) => onSubmit(costTypeFormToDto(values))}
    >
      <fieldset disabled={submitting} className="contents">
        <CostTypeBaseFields
          form={form}
          buildings={buildings}
          buildingFieldDisabled={mode === "edit"}
        />
      </fieldset>
      <FormActions
        submitting={submitting}
        onCancel={onCancel}
        submitLabel={
          mode === "create"
            ? t("ui.common.action.add")
            : t("ui.common.action.save")
        }
      />
    </Form>
  );
};
