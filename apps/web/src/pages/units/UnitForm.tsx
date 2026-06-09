import {
  type UnitCreateDto,
  type UnitFormValues,
  unitFormSchema,
  unitFormToDto,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { Spinner } from "@/components/common/Spinner";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { Savebar } from "@/components/form/Savebar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import type { Building } from "../../lib/buildings";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { UnitDataFields } from "./components/baseData/UnitDataFields";

export const UnitForm = ({
  mode,
  buildings,
  defaultValues,
  onSubmit,
  onCancel,
  savedAt,
}: {
  mode: "create" | "edit";
  buildings: Building[];
  defaultValues: UnitFormValues;
  onSubmit: (values: UnitCreateDto) => Promise<void>;
  onCancel: () => void;

  /**
   * Formatierter Speicherzeitpunkt für die Savebar (nur mode="edit")
   */
  savedAt?: string;
}) => {
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;

  const fields = (
    <fieldset disabled={submitting} className="contents">
      <UnitDataFields
        form={form}
        buildings={buildings}
        buildingFieldDisabled={mode === "edit"}
      />
    </fieldset>
  );

  if (mode === "create") {
    return (
      <Form form={form} onSubmit={(values) => onSubmit(unitFormToDto(values))}>
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

  return (
    <Form form={form} onSubmit={(values) => onSubmit(unitFormToDto(values))}>
      <SectionCard
        icon={domainVisuals.units.icon}
        iconBackground={gradients.units}
        title={t("ui.units.sections.baseData.title")}
        description={t("ui.units.sections.baseData.description")}
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
