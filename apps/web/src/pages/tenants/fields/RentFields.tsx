import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { MonthInput } from "@/components/form/MonthInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../lib/i18n";

/**
 * Felder eines Mietsatzes. Gemeinsame Quelle für das Anlege-Sheet (dort
 * unter `rents.0.`) und das Mietsatz-Sheet der Detailseite, damit beide
 * dieselben Felder zeigen.
 */
export const RentFields = <T extends FieldValues>({
  control,
  prefix = "",
  variant = "full",
}: {
  control: Control<T>;

  /**
   * Pfad-Präfix, wenn die Felder in einem größeren Formular liegen
   * (z. B. "rents.0.")
   */
  prefix?: string;

  /**
   * "initial" = erster Mietsatz beim Anlegen: Zeitraum ergibt sich aus dem
   * Vertrag (Beginn bis Ende), eine Minderung gegenüber einem Vorgänger
   * gibt es noch nicht. Beide Felder entfallen deshalb.
   */
  variant?: "full" | "initial";
}) => {
  const path = (name: string) => `${prefix}${name}` as FieldPath<T>;
  const full = variant === "full";

  return (
    <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {full ? (
        <>
          <MonthInput
            control={control}
            name={path("startDate")}
            label={t("ui.tenant.fields.validFrom")}
            description={t("ui.tenant.fields.rentValidFromHint")}
            boundary="start"
            optional={true}
          />
          <MonthInput
            control={control}
            name={path("endDate")}
            label={t("ui.tenant.fields.validTo")}
            boundary="end"
            optional={true}
          />
        </>
      ) : null}
      <TextInput
        control={control}
        name={path("monthlyBaseRentEuros")}
        label={t("ui.tenant.fields.coldRentEuros")}
        inputMode="decimal"
        suffix="€"
      />
      <TextInput
        control={control}
        name={path("monthlyAdvanceEuros")}
        label={t("ui.tenant.fields.advanceEuros")}
        inputMode="decimal"
        suffix="€"
      />
      {full ? (
        <TextInput
          control={control}
          name={path("reductionReason")}
          label={t("ui.tenant.fields.reductionReason")}
          description={t("ui.tenant.fields.reductionReasonHint")}
          optional={true}
          inputClassName="sm:col-span-2"
        />
      ) : null}
    </FieldGroup>
  );
};
