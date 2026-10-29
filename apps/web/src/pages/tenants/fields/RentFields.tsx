import {
  RENT_CHANGE_REASON_NONE,
  RENT_CHANGE_REASONS,
} from "@einfachvermieter/shared";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { MonthInput } from "@/components/form/MonthInput";
import { SelectInput } from "@/components/form/SelectInput";
import { SheetSection } from "@/components/form/SheetSection";
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
   * Vertrag (Beginn bis Ende), Zeitraum, Änderungsgrund und Notiz entfallen.
   * "first" = erster Mietsatz eines bestehenden Vertrags: Zeitraum ja, aber
   * ohne Vorgänger kein Änderungsgrund und keine Notiz.
   */
  variant?: "full" | "first" | "initial";
}) => {
  const path = (name: string) => `${prefix}${name}` as FieldPath<T>;
  const withPeriod = variant !== "initial";
  const withChange = variant === "full";

  const amounts = (
    <FieldGroup className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
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
      {withChange ? (
        <div className="grid gap-6 sm:col-span-2">
          <SelectInput
            control={control}
            name={path("changeReason")}
            label={t("ui.tenant.fields.changeReason")}
            description={t("ui.tenant.fields.changeReasonHint")}
            optional={true}
            options={[RENT_CHANGE_REASON_NONE, ...RENT_CHANGE_REASONS].map(
              (value) => ({
                value,
                label: t(`tenants.rentChangeReasons.${value}`),
              }),
            )}
          />
          <TextInput
            control={control}
            name={path("changeNote")}
            label={t("ui.tenant.fields.changeNote")}
            optional={true}
          />
        </div>
      ) : null}
    </FieldGroup>
  );

  if (!withPeriod) {
    return amounts;
  }

  // Der Zeitraum ergänzt den Mietsatz, ist aber nicht der Mietsatz selbst:
  // daher am Ende
  return (
    <>
      <SheetSection divider={false}>{amounts}</SheetSection>
      <SheetSection title={t("ui.tenant.sections.validity.title")}>
        <FieldGroup className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
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
        </FieldGroup>
      </SheetSection>
    </>
  );
};
