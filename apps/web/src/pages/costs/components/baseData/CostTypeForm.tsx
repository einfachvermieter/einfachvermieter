import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { Spinner } from "@/components/common/Spinner";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { Savebar } from "@/components/form/Savebar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import type { Building } from "../../../../lib/buildings";
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
  buildings,
  defaultValues,
  onSubmit,
  onCancel,
  savedAt,
}: {
  mode: "create" | "edit";
  buildings: Building[];
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
      <CostTypeBaseFields
        form={form}
        buildings={buildings}
        buildingFieldDisabled={mode === "edit"}
      />
    </fieldset>
  );

  if (mode === "create") {
    return (
      <Form
        form={form}
        onSubmit={(values) => onSubmit(costTypeFormToDto(values))}
      >
        <Card>
          <CardContent>{fields}</CardContent>
        </Card>
        <FormActions
          submitting={submitting}
          onCancel={onCancel}
          submitLabel={t("ui.common.action.add")}
        />
      </Form>
    );
  }

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
    </Form>
  );
};
