import {
  type HeatingPeriodValues,
  type HeatingPeriodValuesFormValues,
  heatingPeriodValuesFormSchema,
  heatingPeriodValuesFormToDto,
  heatingPeriodValuesToFormValues,
  type Period,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiTempHotLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { formatPeriod } from "../../../../lib/format";
import { putHeatingPeriodValues } from "../../../../lib/heatingPeriodValues";
import { t } from "../../../../lib/i18n";
import { useCrudMutation } from "../../../../lib/useCrudMutation";

const invalidateKeys = [
  ["heating-period-values"],
  ["statement-preview"],
] as const;

/**
 * Werte des Abrechnungszeitraums bearbeiten. Das Formular trägt immer alle
 * drei gespeicherten Werte und sendet alle drei: Ein Wert, dessen Feld
 * gerade nicht gezeigt wird, bleibt so unverändert gespeichert.
 */
export const PeriodValuesSheet = ({
  buildingId,
  period,
  values,
  onClose,
}: {
  buildingId: string;
  period: Period;
  values: HeatingPeriodValues;
  onClose: () => void;
}) => {
  const form = useForm<HeatingPeriodValuesFormValues>({
    resolver: zodResolver(heatingPeriodValuesFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: heatingPeriodValuesToFormValues(values),
  });

  const save = useCrudMutation({
    mutationFn: (formValues: HeatingPeriodValuesFormValues) =>
      putHeatingPeriodValues(
        buildingId,
        heatingPeriodValuesFormToDto(formValues, period),
      ),
    invalidateKeys,
    onSuccess: onClose,
  });

  return (
    <FormSheet
      form={form}
      icon={RiTempHotLine}
      title={t("ui.heatingPeriodValues.title")}
      description={t("ui.heatingPeriodValues.sheetDescription", {
        period: formatPeriod(period.start, period.end),
      })}
      submitLabel={t("ui.common.action.save")}
      onSubmit={async (formValues) => {
        await save.mutateAsync(formValues);
      }}
      onClose={onClose}
    >
      <FieldGroup className="gap-4">
        {values.relevance.totalHeatEnergy ? (
          <TextInput
            control={form.control}
            name="totalHeatEnergyKwh"
            label={t("ui.heatingPeriodValues.fields.totalHeatEnergyKwh")}
            labelHelp={t(
              "ui.heatingPeriodValues.fields.totalHeatEnergyKwhDescription",
            )}
            inputMode="decimal"
            suffix="kWh"
            optional={true}
          />
        ) : null}
        {values.relevance.districtHeat ? (
          <>
            <TextInput
              control={form.control}
              name="districtHeatEmissionsKgPerYear"
              label={t(
                "ui.heatingPeriodValues.fields.districtHeatEmissionsKgPerYear",
              )}
              labelHelp={t(
                "ui.heatingPeriodValues.fields.districtHeatEmissionsKgPerYearDescription",
              )}
              inputMode="decimal"
              placeholder={t(
                "ui.heatingPeriodValues.fields.districtHeatEmissionsKgPerYearPlaceholder",
              )}
              suffix="kg"
              optional={true}
            />
            <TextInput
              control={form.control}
              name="districtHeatPrimaryEnergyFactor"
              label={t(
                "ui.heatingPeriodValues.fields.districtHeatPrimaryEnergyFactor",
              )}
              labelHelp={t(
                "ui.heatingPeriodValues.fields.districtHeatPrimaryEnergyFactorDescription",
              )}
              inputMode="decimal"
              placeholder={t(
                "ui.heatingPeriodValues.fields.districtHeatPrimaryEnergyFactorPlaceholder",
              )}
              optional={true}
            />
          </>
        ) : null}
      </FieldGroup>
    </FormSheet>
  );
};
