import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { SubformShell } from "@/components/form/SubformShell";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import { type ResidentRowValues, residentRowSchema } from "./residentRow";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 5, 11, 1);

export const ResidentRowForm = ({
  defaultValues,
  lockContractParty,
  onSubmit,
  onCancel,
}: {
  defaultValues: ResidentRowValues;
  lockContractParty: boolean;
  onSubmit: (values: ResidentRowValues) => void;
  onCancel: () => void;
}) => {
  const form = useForm<ResidentRowValues>({
    resolver: zodResolver(residentRowSchema),
    defaultValues,
  });

  return (
    <SubformShell onSubmit={form.handleSubmit(onSubmit)} onCancel={onCancel}>
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          control={form.control}
          name="firstName"
          label={t("ui.tenant.fields.firstName")}
        />
        <TextInput
          control={form.control}
          name="lastName"
          label={t("ui.tenant.fields.lastName")}
        />
        <TextInput
          control={form.control}
          name="email"
          label={t("ui.tenant.fields.email")}
          type="email"
          optional={true}
        />
        <TextInput
          control={form.control}
          name="phone"
          label={t("ui.tenant.fields.phone")}
          optional={true}
        />
        <DateInput
          control={form.control}
          name="moveInDate"
          label={t("ui.tenant.fields.moveIn")}
          optional={true}
          startMonth={calendarStart}
          endMonth={calendarEnd}
        />
        <DateInput
          control={form.control}
          name="moveOutDate"
          label={t("ui.tenant.fields.moveOut")}
          optional={true}
          startMonth={calendarStart}
          endMonth={calendarEnd}
        />
      </FieldGroup>
      <SwitchInput
        control={form.control}
        name="isContractParty"
        label={t("ui.tenant.fields.isContractParty")}
        disabled={lockContractParty}
      />
    </SubformShell>
  );
};
