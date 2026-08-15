import {
  type HeatingFormValues,
  type HeatingSettingsWriteDto,
  heatingFormToDto,
} from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import type { Meter } from "../../lib/meters";
import { HeatingSettingsFields } from "./components/settings/HeatingSettingsFields";

export const HeatingForm = ({
  form,
  hotWaterMeterCandidates,
  onSubmit,
  onCancel,
  savedAt,
}: {
  form: UseFormReturn<HeatingFormValues>;
  hotWaterMeterCandidates: Meter[];
  onSubmit: (values: HeatingSettingsWriteDto) => Promise<void>;
  onCancel: () => void;
  /** Formatierter Speicherzeitpunkt für die Savebar (leer beim Anlegen) */
  savedAt?: string;
}) => {
  const submitting = form.formState.isSubmitting;

  return (
    <Form form={form} onSubmit={(values) => onSubmit(heatingFormToDto(values))}>
      <fieldset disabled={submitting} className="contents">
        <HeatingSettingsFields
          form={form}
          hotWaterMeterCandidates={hotWaterMeterCandidates}
        />
      </fieldset>
      <Savebar
        dirty={form.formState.isDirty}
        savedAt={savedAt}
        submitting={submitting}
        onCancel={onCancel}
      />
    </Form>
  );
};
