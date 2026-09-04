import { zodResolver } from "@hookform/resolvers/zod";
import { RiFireLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../lib/i18n";
import {
  type GasFactorRowValues,
  gasFactorRowSchema,
} from "../components/gasFactors/gasFactorRow";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 5, 11, 1);

/**
 * Einen Brennwert-Zeitraum (Zustandszahl x Brennwert) im FormSheet
 * erfassen bzw. bearbeiten
 */
export const MeterGasFactorSheet = ({
  title,
  defaultValues,
  onSubmit,
  onClose,
}: {
  title: string;
  defaultValues: GasFactorRowValues;
  onSubmit: (values: GasFactorRowValues) => Promise<void>;
  onClose: () => void;
}) => {
  const form = useForm<GasFactorRowValues>({
    resolver: zodResolver(gasFactorRowSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  return (
    <FormSheet
      form={form}
      icon={RiFireLine}
      title={title}
      submitLabel={t("ui.common.action.save")}
      onSubmit={onSubmit}
      onClose={onClose}
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
    </FormSheet>
  );
};
