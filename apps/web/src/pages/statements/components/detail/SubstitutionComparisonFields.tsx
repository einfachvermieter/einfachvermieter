import type { UseFormReturn } from "react-hook-form";
import { CheckboxGroupInput } from "@/components/form/CheckboxGroupInput";
import { Reveal } from "@/components/form/Reveal";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { t } from "../../../../lib/i18n";
import type { SubstitutionFormValues } from "../../../../lib/substitutionForm";
import type { SubstitutionOptions } from "../../../../lib/substitutions";

/**
 * Verfahren b und c: Vergleichswohnungen bzw. Nutzergruppe aus dem Gebäude
 * oder von Hand belegter Vergleich (nicht bei HKV)
 */
export const SubstitutionComparisonFields = ({
  form,
  values,
  options,
}: {
  form: UseFormReturn<SubstitutionFormValues>;
  values: SubstitutionFormValues;
  options: SubstitutionOptions | undefined;
}) => {
  const comparisonOptions = (options?.comparisonUnits ?? []).map((unit) => ({
    value: unit.id,
    label: unit.name,
    ...(unit.isUsable
      ? {}
      : { description: t("ui.substitutions.fields.comparisonUnitUnusable") }),
  }));

  if (values.basisSource === "manual_reference") {
    return (
      <>
        <TextInput
          control={form.control}
          name="manualComparisonConsumption"
          label={t("ui.substitutions.fields.manualComparisonConsumption")}
          inputMode="decimal"
        />
        <TextInput
          control={form.control}
          name="manualComparisonAreaSqm"
          label={t("ui.substitutions.fields.manualComparisonAreaSqm")}
          inputMode="decimal"
        />
      </>
    );
  }

  if (values.method === "comparable_rooms") {
    return (
      <CheckboxGroupInput
        control={form.control}
        name="comparisonUnitIds"
        label={t("ui.substitutions.fields.comparisonUnits")}
        emptyMessage={t("ui.substitutions.fields.comparisonUnitsEmpty")}
        description={t("ui.substitutions.fields.comparisonUnitsHint")}
        options={comparisonOptions}
      />
    );
  }

  return (
    <>
      <SwitchInput
        control={form.control}
        name="useGroup"
        label={t("ui.substitutions.fields.useGroup")}
      />
      <Reveal open={values.useGroup}>
        <CheckboxGroupInput
          control={form.control}
          name="comparisonUnitIds"
          label={t("ui.substitutions.fields.groupUnits")}
          emptyMessage={t("ui.substitutions.fields.comparisonUnitsEmpty")}
          options={comparisonOptions}
        />
      </Reveal>
    </>
  );
};
