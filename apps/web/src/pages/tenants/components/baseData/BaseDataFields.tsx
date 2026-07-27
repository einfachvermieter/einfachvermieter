import type { TenantFormValues } from "@einfachvermieter/shared";
import { RiKey2Line } from "@remixicon/react";
import type { UseFormReturn } from "react-hook-form";
import { SectionCard } from "@/components/common/SectionCard";
import { DateInput } from "@/components/form/DateInput";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import { gradients } from "../../../../lib/domainVisuals";
import { t } from "../../../../lib/i18n";
import { tenantKindValues } from "../../../../lib/tenants";
import type { Unit } from "../../../../lib/units";

/**
 * Mietbeginn oder Mieteende mitten im Abrechnungsjahr verlangt nach
 * HeizkostenV eine Zwischenablesung der Verbrauchszähler. Als Näherung
 * für "mitten im Jahr" dient das Kalenderjahr. Ohne Zwischenablesung
 * rechnet die Abrechnung den Stichtagsstand nur hoch.
 */
const isMidYear = (startDate: string, endDate: string): boolean =>
  (startDate.length === 10 && !startDate.endsWith("-01-01")) ||
  (endDate.length === 10 && !endDate.endsWith("-12-31"));

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
  const kindOptions = tenantKindValues.map((value) => ({
    value,
    label: t(`tenants.kinds.${value}`),
  }));
  const showInterimReadingHint = isMidYear(
    form.watch("startDate") ?? "",
    form.watch("endDate") ?? "",
  );

  return (
    <SectionCard
      icon={RiKey2Line}
      iconBackground={gradients.bank}
      title={t("ui.tenant.sections.contract.title")}
      description={t("ui.tenant.sections.contract.description")}
    >
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
      </FieldGroup>
      {showInterimReadingHint ? (
        <Alert variant="info">
          <AlertDescription>
            {t("ui.tenant.fields.interimReadingHint")}
          </AlertDescription>
        </Alert>
      ) : null}
    </SectionCard>
  );
};
