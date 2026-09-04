import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../lib/i18n";

const today = new Date();
const calendarStart = new Date(today.getFullYear() - 20, 0, 1);
const calendarEnd = new Date(today.getFullYear() + 5, 11, 1);

/**
 * Felder eines Bewohners. Gemeinsame Quelle für das Anlege-Sheet (dort
 * unter `residents.0.`) und das Bewohner-Sheet der Detailseite, damit
 * beide dieselben Felder zeigen.
 */
export const ResidentFields = <T extends FieldValues>({
  control,
  prefix = "",
  lockContractParty,
  variant = "full",
}: {
  control: Control<T>;

  /**
   * Pfad-Präfix, wenn die Felder in einem größeren Formular liegen
   * (z. B. "residents.0.")
   */
  prefix?: string;

  /**
   * Beim einzigen Bewohner bleibt "Vertragspartner" erzwungen an
   */
  lockContractParty: boolean;

  /**
   * "initial" = erster Vertragspartner beim Anlegen: Ein- und Auszug
   * folgen dem Vertragszeitraum und werden deshalb nicht erfasst.
   */
  variant?: "full" | "initial";
}) => {
  const path = (name: string) => `${prefix}${name}` as FieldPath<T>;

  return (
    <>
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          control={control}
          name={path("firstName")}
          label={t("ui.tenant.fields.firstName")}
        />
        <TextInput
          control={control}
          name={path("lastName")}
          label={t("ui.tenant.fields.lastName")}
        />
        <TextInput
          control={control}
          name={path("email")}
          label={t("ui.tenant.fields.email")}
          type="email"
          optional={true}
        />
        <TextInput
          control={control}
          name={path("phone")}
          label={t("ui.tenant.fields.phone")}
          optional={true}
        />
        {variant === "full" ? (
          <>
            <DateInput
              control={control}
              name={path("moveInDate")}
              label={t("ui.tenant.fields.moveIn")}
              optional={true}
              startMonth={calendarStart}
              endMonth={calendarEnd}
            />
            <DateInput
              control={control}
              name={path("moveOutDate")}
              label={t("ui.tenant.fields.moveOut")}
              optional={true}
              startMonth={calendarStart}
              endMonth={calendarEnd}
            />
          </>
        ) : null}
      </FieldGroup>
      <SwitchInput
        control={control}
        name={path("isContractParty")}
        label={t("ui.tenant.fields.isContractParty")}
        disabled={lockContractParty}
      />
    </>
  );
};
