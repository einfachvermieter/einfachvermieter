import {
  type HeatingFormValues,
  heatingProrationMethods,
} from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { SelectInput } from "@/components/form/SelectInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import { HeatingProrationChart } from "./HeatingProrationChart";

/**
 * Verfahren, nach dem ein angebrochener Abrechnungszeitraum bei Mieter-
 * oder Leerstandswechsel auf die Monate verteilt wird
 */
export const HeatingProrationFields = ({
  form,
}: {
  form: UseFormReturn<HeatingFormValues>;
}) => {
  const mode = form.watch("mode");
  const prorationMethod = form.watch("prorationMethod");

  const prorationMethodOptions = heatingProrationMethods.map((value) => ({
    value,
    label: t(`ui.heating.prorationMethods.${value}`),
  }));

  return (
    <FieldGroup className="gap-4">
      <SelectInput
        control={form.control}
        name="prorationMethod"
        label={t("ui.heating.fields.prorationMethod")}
        labelHelp={
          mode === "external"
            ? t("ui.heating.fields.prorationMethodDescriptionExternal")
            : t("ui.heating.fields.prorationMethodDescription")
        }
        options={prorationMethodOptions}
      />
      <HeatingProrationChart method={prorationMethod} />
    </FieldGroup>
  );
};
