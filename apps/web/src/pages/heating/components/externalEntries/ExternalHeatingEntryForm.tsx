import {
  type ExternalHeatingEntry,
  type ExternalHeatingEntryCreateDto,
  type ExternalHeatingEntryFormValues,
  emptyExternalHeatingEntryFormValues,
  externalHeatingEntryFormToDto,
  externalHeatingEntryToFormValues,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form } from "@/components/form/Form";
import { FormActions } from "@/components/form/FormActions";
import { MonthInput } from "@/components/form/MonthInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { t } from "../../../../lib/i18n";
import type { Unit } from "../../../../lib/units";

const formSchema = z.object({
  unitId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  totalCents: z.string().min(1),
  baseCostCents: z.string(),
  consumptionCostCents: z.string(),
  notes: z.string(),
});

export const ExternalHeatingEntryForm = ({
  units,
  defaultEntry,
  onSubmit,
  onCancel,
}: {
  units: Unit[];
  defaultEntry: ExternalHeatingEntry | null;
  onSubmit: (dto: ExternalHeatingEntryCreateDto) => Promise<void>;
  onCancel: () => void;
}) => {
  const form = useForm<ExternalHeatingEntryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultEntry
      ? externalHeatingEntryToFormValues(defaultEntry)
      : emptyExternalHeatingEntryFormValues,
  });

  useEffect(() => {
    form.reset(
      defaultEntry
        ? externalHeatingEntryToFormValues(defaultEntry)
        : emptyExternalHeatingEntryFormValues,
    );
  }, [defaultEntry, form]);

  const submitting = form.formState.isSubmitting;

  const unitOptions = units.map((unit) => ({
    value: unit.id,
    label: unit.name,
  }));

  return (
    <Form
      form={form}
      onSubmit={(values) => onSubmit(externalHeatingEntryFormToDto(values))}
    >
      <fieldset disabled={submitting} className="contents">
        <SelectInput
          control={form.control}
          name="unitId"
          label={t("ui.heating.external.fields.unit")}
          options={unitOptions}
          placeholder={t("ui.heating.external.fields.unit")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MonthInput
            control={form.control}
            name="periodStart"
            label={t("ui.heating.external.fields.periodStart")}
            boundary="start"
          />
          <MonthInput
            control={form.control}
            name="periodEnd"
            label={t("ui.heating.external.fields.periodEnd")}
            boundary="end"
          />
        </div>
        <TextInput
          control={form.control}
          name="totalCents"
          label={t("ui.heating.external.fields.totalCents")}
          inputMode="decimal"
          suffix="€"
          inputClassName="max-w-xs"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            control={form.control}
            name="baseCostCents"
            label={t("ui.heating.external.fields.baseCostCents")}
            inputMode="decimal"
            suffix="€"
            optional={true}
          />
          <TextInput
            control={form.control}
            name="consumptionCostCents"
            label={t("ui.heating.external.fields.consumptionCostCents")}
            inputMode="decimal"
            suffix="€"
            optional={true}
          />
        </div>
        <TextInput
          control={form.control}
          name="notes"
          label={t("ui.heating.external.fields.notes")}
          optional={true}
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
