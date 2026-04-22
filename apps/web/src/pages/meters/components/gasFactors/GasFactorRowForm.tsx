import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { TextInput } from "@/components/form/TextInput";
import { Button } from "@/components/ui/Button";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import { type GasFactorRowValues, gasFactorRowSchema } from "./gasFactorRow";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 5, 11, 1);

export const GasFactorRowForm = ({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: GasFactorRowValues;
  onSubmit: (values: GasFactorRowValues) => void;
  onCancel: () => void;
}) => {
  const form = useForm<GasFactorRowValues>({
    resolver: zodResolver(gasFactorRowSchema),
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
        <DateInput
          control={form.control}
          name="validFrom"
          label={t("ui.meters.gasFactors.validFrom")}
          startMonth={calendarStart}
          endMonth={calendarEnd}
        />
        <DateInput
          control={form.control}
          name="validUntil"
          label={t("ui.meters.gasFactors.validUntil")}
          optional={true}
          description={t("ui.meters.gasFactors.lastValidUntilHint")}
          startMonth={calendarStart}
          endMonth={calendarEnd}
        />
        <TextInput
          control={form.control}
          name="energyFactor"
          label={t("ui.meters.fields.energyFactor")}
          inputMode="decimal"
          placeholder={t("ui.meters.fields.energyFactorPlaceholder")}
          description={t("ui.meters.fields.energyFactorDescription")}
          optional={true}
        />
        <TextInput
          control={form.control}
          name="notes"
          label={t("ui.meters.gasFactors.notes")}
          placeholder={t("ui.meters.gasFactors.notesPlaceholder")}
          optional={true}
        />
      </FieldGroup>
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
