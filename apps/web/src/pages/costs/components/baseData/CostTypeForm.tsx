import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import { costTypeVisual } from "../../../../lib/domainVisuals";
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
  defaultValues,
  onSubmit,
  onCancel,
  savedAt,
}: {
  mode: "create" | "edit";
  defaultValues: CostTypeFormValues;
  onSubmit: (values: CostTypeSubmitValues) => Promise<void>;
  onCancel: () => void;
  /** Formatierter Speicherzeitpunkt für die Savebar (nur mode="edit") */
  savedAt?: string;
}) => {
  const form = useForm<CostTypeFormValues>({
    resolver: zodResolver(costTypeFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;

  const fields = (
    <fieldset disabled={submitting} className="contents">
      <CostTypeBaseFields form={form} />
    </fieldset>
  );

  const visual = costTypeVisual(defaultValues);

  return (
    <Form
      form={form}
      onSubmit={(values) => onSubmit(costTypeFormToDto(values))}
    >
      <SectionCard
        icon={visual.icon}
        iconBackground={visual.gradient}
        title={t("ui.costs.detail.sectionTitle")}
        description={t("ui.costs.detail.sectionDescription")}
      >
        {fields}
      </SectionCard>
      <Savebar
        dirty={form.formState.isDirty}
        savedAt={savedAt}
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
