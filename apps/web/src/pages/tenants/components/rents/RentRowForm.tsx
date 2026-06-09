import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MonthInput } from "@/components/form/MonthInput";
import { SubformShell } from "@/components/form/SubformShell";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import { type RentRowValues, rentRowSchema } from "./rentRow";

export const RentRowForm = ({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: RentRowValues;
  onSubmit: (values: RentRowValues) => void;
  onCancel: () => void;
}) => {
  const form = useForm<RentRowValues>({
    resolver: zodResolver(rentRowSchema),
    defaultValues,
  });

  return (
    <SubformShell onSubmit={form.handleSubmit(onSubmit)} onCancel={onCancel}>
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MonthInput
          control={form.control}
          name="startDate"
          label={t("ui.tenant.fields.validFrom")}
          boundary="start"
        />
        <MonthInput
          control={form.control}
          name="endDate"
          label={t("ui.tenant.fields.validTo")}
          boundary="end"
          optional={true}
        />
        <TextInput
          control={form.control}
          name="monthlyBaseRentEuros"
          label={t("ui.tenant.fields.coldRentEuros")}
          inputMode="decimal"
          suffix="€"
        />
        <TextInput
          control={form.control}
          name="monthlyAdvanceEuros"
          label={t("ui.tenant.fields.advanceEuros")}
          inputMode="decimal"
          suffix="€"
        />
        <TextInput
          control={form.control}
          name="reductionReason"
          label={t("ui.tenant.fields.reductionReason")}
          description={t("ui.tenant.fields.reductionReasonHint")}
          optional={true}
          inputClassName="sm:col-span-2"
        />
      </FieldGroup>
    </SubformShell>
  );
};
