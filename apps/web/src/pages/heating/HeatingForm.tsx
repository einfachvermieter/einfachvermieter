import {
  type HeatingFormValues,
  type HeatingSettingsWriteDto,
  heatingFormToDto,
} from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import type { Building } from "../../lib/buildings";
import { t } from "../../lib/i18n";
import type { Meter } from "../../lib/meters";
import { HeatingSettingsFields } from "./components/settings/HeatingSettingsFields";

export const HeatingForm = ({
  form,
  buildings,
  buildingFieldDisabled = false,
  hotWaterMeterCandidates,
  onSubmit,
  onCancel,
}: {
  form: UseFormReturn<HeatingFormValues>;
  buildings: Building[];
  buildingFieldDisabled?: boolean;
  hotWaterMeterCandidates: Meter[];
  onSubmit: (values: HeatingSettingsWriteDto) => Promise<void>;
  onCancel: () => void;
}) => {
  const submitting = form.formState.isSubmitting;

  return (
    <Form form={form} onSubmit={(values) => onSubmit(heatingFormToDto(values))}>
      <fieldset disabled={submitting} className="contents">
        <HeatingSettingsFields
          form={form}
          buildings={buildings}
          buildingFieldDisabled={buildingFieldDisabled}
          hotWaterMeterCandidates={hotWaterMeterCandidates}
        />
      </fieldset>
      <FormActions
        submitting={submitting}
        onCancel={onCancel}
        submitLabel={t("ui.common.action.save")}
      />
    </Form>
  );
};
