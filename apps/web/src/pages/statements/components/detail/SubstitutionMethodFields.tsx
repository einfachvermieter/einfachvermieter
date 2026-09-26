import { substitutionMethods } from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { TextareaInput } from "@/components/form/TextareaInput";
import { t } from "../../../../lib/i18n";
import type { SubstitutionFormValues } from "../../../../lib/substitutionForm";
import type { SubstitutionOptions } from "../../../../lib/substitutions";
import { SubstitutionComparisonFields } from "./SubstitutionComparisonFields";
import { SubstitutionSameRoomsFields } from "./SubstitutionSameRoomsFields";

/**
 * Ob ein Verfahren mit den vorhandenen Daten rechenbar ist (ohne
 * Vorauswahl; die Wahl bleibt beim Nutzer)
 */
const isComputable = (
  method: (typeof substitutionMethods)[number],
  options: SubstitutionOptions,
): boolean => {
  const usableUnits = options.comparisonUnits.filter(
    (unit) => unit.isUsable,
  ).length;
  if (method === "same_rooms_comparable_period") {
    return options.referenceYears.some((entry) => entry.isUsable);
  }

  return method === "comparable_rooms" ? usableUnits >= 2 : usableUnits >= 1;
};

/**
 * Verfahren aus § 9a Abs. 1, Datengrundlage und die Felder dazu
 */
export const SubstitutionMethodFields = ({
  form,
  values,
  options,
}: {
  form: UseFormReturn<SubstitutionFormValues>;
  values: SubstitutionFormValues;
  options: SubstitutionOptions | undefined;
}) => {
  const isSameRooms = values.method === "same_rooms_comparable_period";

  return (
    <>
      <ChoiceTilesInput
        control={form.control}
        name="method"
        label={t("ui.substitutions.fields.method")}
        columns={1}
        options={substitutionMethods.map((method) => ({
          value: method,
          title: t(`ui.substitutions.method.${method}`),
          description: options
            ? t(
                isComputable(method, options)
                  ? "ui.substitutions.methodUsable"
                  : "ui.substitutions.methodNotUsable",
              )
            : undefined,
        }))}
      />
      <ChoiceTilesInput
        control={form.control}
        name="basisSource"
        label={t("ui.substitutions.fields.basisSource")}
        options={(["meter_readings", "manual_reference"] as const).map(
          (source) => ({
            value: source,
            title: t(`ui.substitutions.basisSource.${source}`),
            description: t(`ui.substitutions.basisSourceDescription.${source}`),
            // HKV-Werte anderer Gebäude sind nicht vergleichbar.
            disabled:
              source === "manual_reference" &&
              !isSameRooms &&
              options?.shareMethod === true,
          }),
        )}
      />
      {isSameRooms ? (
        <SubstitutionSameRoomsFields
          form={form}
          values={values}
          options={options}
        />
      ) : null}
      {values.method !== "" && !isSameRooms ? (
        <SubstitutionComparisonFields
          form={form}
          values={values}
          options={options}
        />
      ) : null}
      {values.basisSource === "manual_reference" ? (
        <TextareaInput
          control={form.control}
          name="basisNote"
          label={t("ui.substitutions.fields.basisNote")}
        />
      ) : null}
    </>
  );
};
