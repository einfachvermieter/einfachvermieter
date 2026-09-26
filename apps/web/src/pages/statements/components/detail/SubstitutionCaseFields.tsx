import { formatNumber, substitutionReasons } from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { CheckboxGroupInput } from "@/components/form/CheckboxGroupInput";
import { SelectInput } from "@/components/form/SelectInput";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextareaInput } from "@/components/form/TextareaInput";
import { TextInput } from "@/components/form/TextInput";
import { t } from "../../../../lib/i18n";
import {
  isWholeUnit,
  type SubstitutionFormValues,
  type SubstitutionSheetTarget,
} from "../../../../lib/substitutionForm";
import type { SubstitutionOptions } from "../../../../lib/substitutions";

/**
 * Wohnung, Bereich, Ursache, betroffene Zähler und Fläche
 */
export const SubstitutionCaseFields = ({
  form,
  values,
  options,
  target,
}: {
  form: UseFormReturn<SubstitutionFormValues>;
  values: SubstitutionFormValues;
  options: SubstitutionOptions | undefined;
  target: SubstitutionSheetTarget;
}) => {
  const isEdit = target.kind === "edit";
  const selectedMeters = (options?.meters ?? []).filter((meter) =>
    values.affectedMeterIds.includes(meter.id),
  );
  const showArea = options !== undefined && selectedMeters.length > 0;
  const needsPartialArea =
    values.scope === "heating" && !isWholeUnit(values, options);

  return (
    <>
      <SelectInput
        control={form.control}
        name="unitId"
        label={t("ui.substitutions.fields.unit")}
        disabled={isEdit}
        options={target.units.map((unit) => ({
          value: unit.id,
          label: unit.name,
        }))}
        onValueChange={() => form.setValue("affectedMeterIds", [])}
      />
      {target.scopes.length > 1 ? (
        <SelectInput
          control={form.control}
          name="scope"
          label={t("ui.substitutions.fields.scope")}
          disabled={isEdit}
          options={target.scopes.map((scope) => ({
            value: scope,
            label: t(`ui.substitutions.scope.${scope}`),
          }))}
          onValueChange={() => form.setValue("affectedMeterIds", [])}
        />
      ) : null}
      <SelectInput
        control={form.control}
        name="reason"
        label={t("ui.substitutions.fields.reason")}
        options={substitutionReasons.map((reason) => ({
          value: reason,
          label: t(`ui.substitutions.reason.${reason}`),
        }))}
        onValueChange={(reason) =>
          form.setValue(
            "meterKeptCounting",
            reason === "reading_missed" || reason === "reading_not_possible",
          )
        }
      />
      {values.reason === "other" ? (
        <TextareaInput
          control={form.control}
          name="reasonNote"
          label={t("ui.substitutions.fields.reasonNote")}
        />
      ) : null}
      {values.unitId === "" ? null : (
        <CheckboxGroupInput
          control={form.control}
          name="affectedMeterIds"
          label={t("ui.substitutions.fields.meters")}
          emptyMessage={t("ui.substitutions.fields.metersEmpty")}
          options={(options?.meters ?? []).map((meter) => ({
            value: meter.id,
            label: meter.label,
            ...(meter.hasGap
              ? { description: t("ui.substitutions.fields.meterGap") }
              : {}),
          }))}
        />
      )}
      {selectedMeters.some((meter) => meter.isContinuous) ? (
        <SwitchInput
          control={form.control}
          name="meterKeptCounting"
          label={t("ui.substitutions.fields.meterKeptCounting")}
          labelHelp={t("ui.substitutions.fields.meterKeptCountingHelp")}
        />
      ) : null}
      {showArea && needsPartialArea ? (
        <TextInput
          control={form.control}
          name="affectedAreaSqm"
          label={t("ui.substitutions.fields.area")}
          description={t("ui.substitutions.fields.areaHint")}
          inputMode="decimal"
        />
      ) : null}
      {showArea && !needsPartialArea ? (
        <p className="text-sm text-muted-foreground">
          {t("ui.substitutions.fields.areaWholeUnit", {
            area: t("ui.common.measures.sqm", {
              value: formatNumber(options.wholeUnitAreaSqm, 2),
            }),
          })}
        </p>
      ) : null}
    </>
  );
};
