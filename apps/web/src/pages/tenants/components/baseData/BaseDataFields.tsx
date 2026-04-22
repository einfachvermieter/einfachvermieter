import type { TenantFormValues } from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextareaInput } from "@/components/form/TextareaInput";
import { TextInput } from "@/components/form/TextInput";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import { selectableTenantKindValues } from "../../../../lib/tenants";
import type { Unit } from "../../../../lib/units";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 5, 11, 1);

export const BaseDataFields = ({
  form,
  units,
  unitFieldDisabled,
}: {
  form: UseFormReturn<TenantFormValues>;
  units: Unit[];
  unitFieldDisabled: boolean;
}) => {
  const unitOptions = units.map((unit) => ({
    value: unit.id,
    label: unit.name,
  }));
  const kindOptions = selectableTenantKindValues.map((value) => ({
    value,
    label: t(`tenants.kinds.${value}`),
  }));

  return (
    <Card>
      <CardContent>
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectInput
            control={form.control}
            name="unitId"
            label={t("ui.tenant.fields.unit")}
            options={unitOptions}
            disabled={unitFieldDisabled}
          />
          <SelectInput
            control={form.control}
            name="kind"
            label={t("ui.tenant.fields.kind")}
            options={kindOptions}
          />
          <DateInput
            control={form.control}
            name="startDate"
            label={t("ui.tenant.fields.start")}
            startMonth={calendarStart}
            endMonth={calendarEnd}
          />
          <DateInput
            control={form.control}
            name="endDate"
            label={t("ui.tenant.fields.end")}
            optional={true}
            startMonth={calendarStart}
            endMonth={calendarEnd}
          />
          <TextInput
            control={form.control}
            name="depositEuros"
            inputMode="decimal"
            placeholder="0,00"
            label={t("ui.tenant.fields.deposit")}
            description={t("ui.tenant.fields.depositHint")}
            suffix="€"
          />
          <TextareaInput
            control={form.control}
            name="notes"
            label={t("ui.tenant.fields.notes")}
            rows={2}
            fieldClassName="sm:col-span-2"
            textareaClassName="field-sizing-fixed min-h-0 resize-y"
          />
        </FieldGroup>
      </CardContent>
    </Card>
  );
};
