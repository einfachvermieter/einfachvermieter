import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CheckboxInput } from "@/components/form/CheckboxInput";
import { DateInput } from "@/components/form/DateInput";
import { TextInput } from "@/components/form/TextInput";
import { Button } from "@/components/ui/Button";
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
    <form
      onSubmit={async (event) => {
        event.stopPropagation();
        await form.handleSubmit(onSubmit)(event);
      }}
      noValidate={true}
      className="space-y-6"
    >
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
      <CheckboxInput
        control={form.control}
        name="isContractParty"
        label={t("ui.tenant.fields.isContractParty")}
        disabled={lockContractParty}
      />
      <div className="flex gap-2 sm:justify-end">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          className="flex-1 sm:flex-initial"
        >
          {t("ui.common.action.cancel")}
        </Button>
        <Button type="submit" className="flex-1 sm:flex-initial">
          {t("ui.common.action.confirm")}
        </Button>
      </div>
    </form>
  );
};
