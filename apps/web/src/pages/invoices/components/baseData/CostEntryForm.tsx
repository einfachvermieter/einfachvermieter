import { RiBillLine } from "@remixicon/react";
import type { UseFormReturn } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { Spinner } from "@/components/common/Spinner";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { Savebar } from "@/components/form/Savebar";
import { Button } from "@/components/ui/Button";
import type { CostType } from "../../../../lib/costs";
import { gradients } from "../../../../lib/domainVisuals";
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
  /** Formatierter Speicherzeitpunkt; gesetzt = Savebar statt FormActions */
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
            icon={RiBillLine}
            iconBackground={gradients.invoices}
            title={t("ui.invoices.detail.basicsSection")}
            description={t("ui.invoices.detail.basicsDescription")}
          >
            <CostEntryBaseFields form={form} />
          </SectionCard>
          <CostEntryItems form={form} costTypes={costTypes} units={units} />
        </div>
      </fieldset>
      {savedAt === undefined ? (
        <FormActions
          submitting={submitting}
          onCancel={onCancel}
          submitLabel={
            mode === "create"
              ? t("ui.common.action.record")
              : t("ui.common.action.save")
          }
        />
      ) : (
        <Savebar savedAt={savedAt}>
          <Button
            variant="secondary"
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            {t("ui.common.action.cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {t("ui.common.action.save")}
          </Button>
        </Savebar>
      )}
    </Form>
  );
};
