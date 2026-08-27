import type { MeterFormValues } from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { TextInput } from "@/components/form/TextInput";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";

export const HkvFields = ({
  form,
  variant = "sheet",
}: {
  form: UseFormReturn<MeterFormValues>;

  /**
   * "card" hüllt die Felder in eine Card (Altbestand); im Sheet "sheet"
   */
  variant?: "card" | "sheet";
}) => {
  const fields = (
    <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextInput
        control={form.control}
        name="radiator"
        label={t("ui.meters.fields.radiator")}
        placeholder={t("ui.meters.fields.radiatorPlaceholder")}
        optional={true}
      />
      <TextInput
        control={form.control}
        name="kTotal"
        label={t("ui.meters.fields.kTotal")}
        inputMode="decimal"
        placeholder={t("ui.meters.fields.kTotalPlaceholder")}
        description={t("ui.meters.fields.kTotalDescription")}
        inputClassName="max-w-xs"
      />
      <TextInput
        control={form.control}
        name="radiatorManufacturer"
        label={t("ui.meters.fields.radiatorManufacturer")}
        optional={true}
      />
      <TextInput
        control={form.control}
        name="radiatorModel"
        label={t("ui.meters.fields.radiatorModel")}
        optional={true}
      />
      <TextInput
        control={form.control}
        name="radiatorType"
        label={t("ui.meters.fields.radiatorType")}
        placeholder={t("ui.meters.fields.radiatorTypePlaceholder")}
        optional={true}
      />
      <TextInput
        control={form.control}
        name="radiatorDimensions"
        label={t("ui.meters.fields.radiatorDimensions")}
        placeholder={t("ui.meters.fields.radiatorDimensionsPlaceholder")}
        optional={true}
      />
    </FieldGroup>
  );

  if (variant === "sheet") {
    return fields;
  }

  return (
    <Card>
      <CardContent>{fields}</CardContent>
    </Card>
  );
};
