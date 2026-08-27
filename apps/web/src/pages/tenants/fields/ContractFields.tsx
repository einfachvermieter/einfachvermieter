import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { t } from "../../../lib/i18n";
import { tenantKindValues } from "../../../lib/tenants";
import type { Unit } from "../../../lib/units";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 5, 11, 1);

/**
 * Vertragsfelder (Wohnung, Art, Zeitraum, Kaution). Gemeinsame Quelle für
 * das Anlege- und das Bearbeiten-Sheet, damit beide dieselben Felder zeigen.
 */
export const ContractFields = <T extends FieldValues>({
  control,
  units,
  unitDisabled = false,
}: {
  control: Control<T>;
  units: Unit[];
  /**
   * Die Wohnung wechselt man nicht nachträglich (Buchungen hängen daran)
   */
  unitDisabled?: boolean;
}) => {
  const path = (name: string) => name as FieldPath<T>;

  return (
    <>
      <SelectInput
        control={control}
        name={path("unitId")}
        label={t("ui.tenant.fields.unit")}
        options={units.map((unit) => ({ value: unit.id, label: unit.name }))}
        disabled={unitDisabled}
      />
      <SelectInput
        control={control}
        name={path("kind")}
        label={t("ui.tenant.fields.kind")}
        options={tenantKindValues.map((value) => ({
          value,
          label: t(`tenants.kinds.${value}`),
        }))}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateInput
          control={control}
          name={path("startDate")}
          label={t("ui.tenant.fields.start")}
          startMonth={calendarStart}
          endMonth={calendarEnd}
        />
        <DateInput
          control={control}
          name={path("endDate")}
          label={t("ui.tenant.fields.end")}
          optional={true}
          startMonth={calendarStart}
          endMonth={calendarEnd}
        />
      </div>
      <TextInput
        control={control}
        name={path("depositEuros")}
        inputMode="decimal"
        placeholder={t("ui.common.placeholders.amount")}
        label={t("ui.tenant.fields.deposit")}
        description={t("ui.tenant.fields.depositHint")}
        suffix="€"
      />
    </>
  );
};
