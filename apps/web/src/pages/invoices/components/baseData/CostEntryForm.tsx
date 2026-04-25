import type { UseFormReturn } from "react-hook-form";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import type { CostType } from "../../../../lib/costs";
import { t } from "../../../../lib/i18n";
import type { Unit } from "../../../../lib/units";
import { CostEntryBaseFields } from "./CostEntryBaseFields";
import { CostEntryItems } from "./CostEntryItems";
import {
  type CostEntryFormValues,
  type CostEntrySubmitValues,
  costEntryFormToDto,
} from "./costEntryForm.schema";

export const CostEntryForm = ({
  mode,
  form,
  costTypes,
  units,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  form: UseFormReturn<CostEntryFormValues>;
  costTypes: CostType[];
  units: Unit[];
  onSubmit: (values: CostEntrySubmitValues) => Promise<void>;
  onCancel: () => void;
}) => {
  const submitting = form.formState.isSubmitting;

  return (
    <Form
      form={form}
      onSubmit={(values) => onSubmit(costEntryFormToDto(values, costTypes))}
    >
      <fieldset disabled={submitting} className="contents">
        <CostEntryBaseFields form={form} />
        <CostEntryItems form={form} costTypes={costTypes} units={units} />
      </fieldset>
      <FormActions
        submitting={submitting}
        onCancel={onCancel}
        submitLabel={
          mode === "create"
            ? t("ui.common.action.record")
            : t("ui.common.action.save")
        }
      />
    </Form>
  );
};
