import {
  type BuildingCreateDto,
  buildingCreateSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
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

  return (
    <Form form={form} onSubmit={onSubmit}>
      <fieldset disabled={submitting} className="contents">
        <BuildingDataFields form={form} />
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
