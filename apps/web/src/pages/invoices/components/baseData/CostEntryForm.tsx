import { RiReceiptLine } from "@remixicon/react";
import type { UseFormReturn } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
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
  savedAt,
}: {
  mode: "create" | "edit";
  form: UseFormReturn<CostEntryFormValues>;
  costTypes: CostType[];
  units: Unit[];
  onSubmit: (values: CostEntrySubmitValues) => Promise<void>;
  onCancel: () => void;
  /** Formatierter Speicherzeitpunkt für die Savebar (nur mode="edit") */
  savedAt?: string;
}) => {
  const submitting = form.formState.isSubmitting;

  return (
    <Form
      form={form}
      onSubmit={(values) => onSubmit(costEntryFormToDto(values, costTypes))}
    >
      <fieldset disabled={submitting} className="contents">
        <div className="space-y-5">
          <SectionCard
            icon={RiReceiptLine}
            title={t("ui.invoices.detail.basicsSection")}
          >
            <CostEntryBaseFields form={form} />
          </SectionCard>
          <CostEntryItems form={form} costTypes={costTypes} units={units} />
        </div>
      </fieldset>
      <Savebar
        dirty={form.formState.isDirty}
        savedAt={savedAt}
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
