import type { UseFormReturn } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import type { CostEntryFormValues } from "./costEntryForm.schema";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);

export const CostEntryBaseFields = ({
  form,
}: {
  form: UseFormReturn<CostEntryFormValues>;
}) => (
  <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <DateInput
      control={form.control}
      name="invoiceDate"
      label={t("ui.common.columns.invoiceDate")}
      startMonth={calendarStart}
      endMonth={today}
      inputClassName="max-w-xs"
    />
    <TextInput
      control={form.control}
      name="invoiceNumber"
      label={t("ui.costs.entryFields.invoiceNumber")}
      placeholder={t("ui.costs.entryFields.invoiceNumberPlaceholder")}
      optional={true}
    />
    <div className="sm:col-span-2">
      <TextInput
        control={form.control}
        name="vendor"
        label={t("ui.costs.columns.vendor")}
        placeholder={t("ui.costs.entryFields.vendorPlaceholder")}
        optional={true}
      />
    </div>
  </FieldGroup>
);
