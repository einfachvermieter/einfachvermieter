import {
  type BuildingCreateDto,
  buildingCreateSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiBuildingLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import { t } from "../../lib/i18n";
import { BuildingDataFields } from "./components/baseData/BuildingDataFields";

export const BuildingForm = ({
  mode,
  defaultValues,
  savedAt,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  defaultValues: BuildingCreateDto;
  savedAt?: string;
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

  return (
    <Form form={form} onSubmit={onSubmit}>
      <SectionCard
        icon={RiBuildingLine}
        title={t("ui.buildings.sections.baseData.title")}
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
