import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { SheetSection } from "@/components/form/SheetSection";
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
 * beide dieselben Felder zeigen. Ein- und Auszug stehen als Zeitraum am
 * Ende: Sie ergänzen die Angaben zur Person, sind aber nicht die Person.
 */
export const ResidentFields = <T extends FieldValues>({
  control,
  prefix = "",
  contractPartyLock = null,
  variant = "full",
}: {
  control: Control<T>;

  /**
   * Pfad-Präfix, wenn die Felder in einem größeren Formular liegen
   * (z. B. "residents.0.")
   */
  prefix?: string;

  /**
   * Grund, warum "Vertragspartner" nicht abgewählt werden kann (etwa weil
   * es der einzige Bewohner ist). Der Switch bleibt dann an und gesperrt,
   * der Grund steht darunter
   */
  contractPartyLock?: string | null;

  /**
   * "initial" = erster Vertragspartner beim Anlegen: Er ist immer
   * Vertragspartner, Ein- und Auszug folgen dem Vertragszeitraum. Es gibt
   * nur die Angaben zur Person
   */
  variant?: "full" | "initial";
}) => {
  const path = (name: string) => `${prefix}${name}` as FieldPath<T>;

  const person = (
    <FieldGroup className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
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
    </FieldGroup>
  );

  if (variant === "initial") {
    return person;
  }

  return (
    <>
      <SheetSection divider={false}>{person}</SheetSection>
      <SheetSection>
        <SwitchInput
          control={control}
          name={path("isContractParty")}
          label={t("ui.tenant.fields.isContractParty")}
          description={contractPartyLock ?? undefined}
          disabled={contractPartyLock !== null}
        />
      </SheetSection>
      <SheetSection title={t("ui.tenant.sections.validity.title")}>
        <FieldGroup className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
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
        </FieldGroup>
      </SheetSection>
    </>
  );
};
