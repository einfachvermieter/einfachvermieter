import {
  type HeatingFormValues,
  type HeatingSettingsWriteDto,
  heatingFormToDto,
} from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { Spinner } from "@/components/common/Spinner";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { Savebar } from "@/components/form/Savebar";
import { Button } from "@/components/ui/Button";
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
  savedAt,
}: {
  form: UseFormReturn<HeatingFormValues>;
  buildings: Building[];
  buildingFieldDisabled?: boolean;
  hotWaterMeterCandidates: Meter[];
  onSubmit: (values: HeatingSettingsWriteDto) => Promise<void>;
  onCancel: () => void;
  /** Formatierter Speicherzeitpunkt; gesetzt = Savebar statt FormActions */
  savedAt?: string;
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
      {savedAt === undefined ? (
        <FormActions
          submitting={submitting}
          onCancel={onCancel}
          submitLabel={t("ui.common.action.save")}
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
