import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { SubformShell } from "@/components/form/SubformShell";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import { type AddressRowValues, addressRowSchema } from "./addressRow";

const today = new Date();
const validityCalendarStart = new Date(today.getFullYear() - 20, 0, 1);
const validityCalendarEnd = new Date(today.getFullYear() + 5, 11, 1);

export const AddressRowForm = ({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: AddressRowValues;
  onSubmit: (values: AddressRowValues) => void;
  onCancel: () => void;
}) => {
  const form = useForm<AddressRowValues>({
    resolver: zodResolver(addressRowSchema),
    defaultValues,
  });

  return (
    <SubformShell onSubmit={form.handleSubmit(onSubmit)} onCancel={onCancel}>
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateInput
          control={form.control}
          name="startDate"
          label={t("ui.tenant.fields.validFrom")}
          optional={true}
          startMonth={validityCalendarStart}
          endMonth={validityCalendarEnd}
        />
        <DateInput
          control={form.control}
          name="endDate"
          label={t("ui.tenant.fields.validTo")}
          optional={true}
          startMonth={validityCalendarStart}
          endMonth={validityCalendarEnd}
        />
        <TextInput
          control={form.control}
          name="street"
          label={t("ui.tenant.fields.addressStreet")}
          placeholder={t("ui.tenant.fields.addressStreetPlaceholder")}
          inputClassName="sm:col-span-2"
        />
        <TextInput
          control={form.control}
          name="postalCode"
          label={t("ui.tenant.fields.addressPostalCode")}
          inputClassName="tabular-nums"
        />
        <TextInput
          control={form.control}
          name="city"
          label={t("ui.tenant.fields.addressCity")}
        />
      </FieldGroup>
    </SubformShell>
  );
};
