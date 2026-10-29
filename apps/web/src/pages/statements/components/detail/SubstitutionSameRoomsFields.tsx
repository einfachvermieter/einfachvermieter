import type { UseFormReturn } from "react-hook-form";
import { CheckboxGroupInput } from "@/components/form/CheckboxGroupInput";
import { Reveal } from "@/components/form/Reveal";
import { SelectInput } from "@/components/form/SelectInput";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { formatPeriod } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";
import type { SubstitutionFormValues } from "../../../../lib/substitutionForm";
import type { SubstitutionOptions } from "../../../../lib/substitutions";

/**
 * Verfahren a: Vergleichszeitraum ohne Vorauswahl, dazu Vorgänger-Zähler
 * oder von Hand belegte Vergleichswerte
 */
export const SubstitutionSameRoomsFields = ({
  form,
  values,
  options,
}: {
  form: UseFormReturn<SubstitutionFormValues>;
  values: SubstitutionFormValues;
  options: SubstitutionOptions | undefined;
}) => {
  const isManual = values.basisSource === "manual_reference";

  return (
    <>
      <SelectInput
        control={form.control}
        name="referenceYears"
        label={t("ui.substitutions.fields.referenceYear")}
        description={t("ui.substitutions.fields.referenceYearHint")}
        options={(options?.referenceYears ?? []).map((entry) => {
          const label = formatPeriod(entry.period.start, entry.period.end);
          return {
            value: String(entry.years),
            label:
              entry.isUsable || isManual
                ? label
                : t("ui.substitutions.fields.referenceYearUnusable", {
                    period: label,
                  }),
          };
        })}
      />
      {isManual ? (
        <>
          <TextInput
            control={form.control}
            name="manualAffectedConsumption"
            label={t("ui.substitutions.fields.manualAffectedConsumption")}
            inputMode="decimal"
          />
          {options?.shareMethod ? (
            <TextInput
              control={form.control}
              name="manualTotalConsumption"
              label={t("ui.substitutions.fields.manualTotalConsumption")}
              inputMode="decimal"
            />
          ) : null}
        </>
      ) : (
        <>
          <SwitchInput
            control={form.control}
            name="useOtherReferenceMeters"
            label={t("ui.substitutions.fields.useOtherReferenceMeters")}
          />
          <Reveal open={values.useOtherReferenceMeters}>
            <CheckboxGroupInput
              control={form.control}
              name="referenceMeterIds"
              label={t("ui.substitutions.fields.referenceMeters")}
              emptyMessage={t("ui.substitutions.fields.referenceMetersEmpty")}
              options={(options?.allMeters ?? []).map((meter) => ({
                value: meter.id,
                label: meter.label,
                ...(meter.isActive
                  ? {}
                  : {
                      description: t("ui.substitutions.fields.meterInactive"),
                    }),
              }))}
            />
          </Reveal>
        </>
      )}
    </>
  );
};
