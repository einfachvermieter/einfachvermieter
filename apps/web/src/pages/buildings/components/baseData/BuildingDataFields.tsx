import type { BuildingCreateDto } from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";

export const BuildingDataFields = ({
  form,
}: {
  form: UseFormReturn<BuildingCreateDto>;
}) => (
  <FieldGroup className="gap-4">
    <TextInput
      control={form.control}
      name="name"
      label={t("ui.buildings.fields.name")}
      placeholder={t("ui.buildings.fields.namePlaceholder")}
      description={t("ui.buildings.fields.nameDescription")}
    />
    <TextInput
      control={form.control}
      name="addressStreet"
      label={t("ui.buildings.fields.street")}
    />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextInput
        control={form.control}
        name="addressPostalCode"
        label={t("ui.buildings.fields.postalCode")}
        inputMode="numeric"
      />
      <TextInput
        control={form.control}
        name="addressCity"
        label={t("ui.buildings.fields.city")}
      />
    </div>
  </FieldGroup>
);
