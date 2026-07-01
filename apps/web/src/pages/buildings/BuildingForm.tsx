import {
  type BuildingCreateDto,
  buildingCreateSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiBuildingLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { Spinner } from "@/components/common/Spinner";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { Savebar } from "@/components/form/Savebar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { BuildingDataFields } from "./components/baseData/BuildingDataFields";

export const BuildingForm = ({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  defaultValues: BuildingCreateDto;
  onSubmit: (values: BuildingCreateDto) => Promise<void>;
  onCancel: () => void;
}) => {
  const form = useForm<BuildingCreateDto>({
    resolver: zodResolver(buildingCreateSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;

  const fields = (
    <fieldset disabled={submitting} className="contents">
      <BuildingDataFields form={form} />
    </fieldset>
  );

  if (mode === "create") {
    return (
      <Form form={form} onSubmit={onSubmit}>
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
    <Form form={form} onSubmit={onSubmit}>
      <SectionCard
        icon={RiBuildingLine}
        iconBackground={gradients.buildings}
        title={t("ui.buildings.sections.baseData.title")}
        description={t("ui.buildings.sections.baseData.description")}
      >
        {fields}
      </SectionCard>
      <Savebar>
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
