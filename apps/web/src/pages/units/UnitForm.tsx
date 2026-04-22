import {
  type UnitCreateDto,
  type UnitFormValues,
  unitFormSchema,
  unitFormToDto,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import type { Building } from "../../lib/buildings";
import { t } from "../../lib/i18n";
import { UnitDataFields } from "./components/baseData/UnitDataFields";

export const UnitForm = ({
  mode,
  buildings,
  defaultValues,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  buildings: Building[];
  defaultValues: UnitFormValues;
  onSubmit: (values: UnitCreateDto) => Promise<void>;
  onCancel: () => void;
}) => {
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const submitting = form.formState.isSubmitting;

  return (
    <Form form={form} onSubmit={(values) => onSubmit(unitFormToDto(values))}>
      <fieldset disabled={submitting} className="contents">
        <UnitDataFields
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
