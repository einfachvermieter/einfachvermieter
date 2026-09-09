import {
  type ExternalHeatingEntry,
  type ExternalHeatingEntryCreateDto,
  type ExternalHeatingEntryFormValues,
  emptyExternalHeatingEntryFormValues,
  externalHeatingEntryFormToDto,
  externalHeatingEntryToFormValues,
  unsignedAmountRegex,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiExternalLinkLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormSheet } from "@/components/form/FormSheet";
import { MonthInput } from "@/components/form/MonthInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { t } from "../../../lib/i18n";
import type { Unit } from "../../../lib/units";

const amountOrEmpty = z
  .string()
  .refine(
    (value) => value === "" || unsignedAmountRegex.test(value),
    t("ui.form.amountFormat"),
  );

const formSchema = z.object({
  unitId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  totalCents: z.string().regex(unsignedAmountRegex, t("ui.form.amountFormat")),
  baseCostCents: amountOrEmpty,
  consumptionCostCents: amountOrEmpty,
  notes: z.string(),
});

/**
 * Externen Heizkosten-Eintrag im FormSheet anlegen bzw. bearbeiten
 */
export const ExternalHeatingEntrySheet = ({
  units,
  entry,
  onSubmit,
  onClose,
}: {
  units: Unit[];
  /**
   * Bestehender Eintrag; null legt einen neuen an
   */
  entry: ExternalHeatingEntry | null;
  onSubmit: (dto: ExternalHeatingEntryCreateDto) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<ExternalHeatingEntryFormValues>({
    resolver: zodResolver(formSchema),
    reValidateMode: "onSubmit",
    defaultValues: entry
      ? externalHeatingEntryToFormValues(entry)
      : emptyExternalHeatingEntryFormValues,
  });

  const unitOptions = units.map((unit) => ({
    value: unit.id,
    label: unit.name,
  }));

  return (
    <FormSheet
      form={form}
      icon={RiExternalLinkLine}
      title={entry ? t("ui.common.action.edit") : t("ui.heating.external.add")}
      description={t("ui.heating.external.description")}
      submitLabel={
        entry ? t("ui.common.action.save") : t("ui.common.action.create")
      }
      onSubmit={(values) => onSubmit(externalHeatingEntryFormToDto(values))}
      onClose={onClose}
    >
      <SelectInput
        control={form.control}
        name="unitId"
        label={t("ui.heating.external.fields.unit")}
        options={unitOptions}
        placeholder={t("ui.heating.external.fields.unit")}
      />
      <div className="grid grid-cols-2 gap-4">
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
      />
      <div className="grid grid-cols-2 gap-4">
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
    </FormSheet>
  );
};
