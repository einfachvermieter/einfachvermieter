import type { UnitFormValues } from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { ReadonlyField } from "@/components/form/ReadonlyField";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import type { Building } from "../../../../lib/buildings";
import { t } from "../../../../lib/i18n";

export const UnitDataFields = ({
  form,
  buildings,
  buildingFieldDisabled,
}: {
  form: UseFormReturn<UnitFormValues>;
  buildings: Building[];
  buildingFieldDisabled: boolean;
}) => (
  <FieldGroup className="gap-5">
    {buildingFieldDisabled ? (
      <ReadonlyField
        label={t("ui.buildings.title")}
        value={
          buildings.find(
            (building) => building.id === form.getValues("buildingId"),
          )?.name
        }
      />
    ) : (
      <SelectInput
        control={form.control}
        name="buildingId"
        label={t("ui.buildings.title")}
        options={buildings.map((building) => ({
          value: building.id,
          label: building.name,
        }))}
      />
    )}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextInput
        control={form.control}
        name="name"
        label={t("ui.units.fields.name")}
        placeholder={t("ui.units.fields.namePlaceholder")}
      />
      <TextInput
        control={form.control}
        name="unitNumber"
        label={t("ui.units.fields.unitNumber")}
        description={t("ui.units.fields.unitNumberDescription")}
        placeholder={t("ui.units.fields.unitNumberPlaceholder")}
        optional={true}
      />
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextInput
        control={form.control}
        name="areaSqm"
        label={t("ui.units.fields.area")}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="120"
        suffix="m²"
      />
      <TextInput
        control={form.control}
        name="heatingAreaSqm"
        label={t("ui.units.fields.heatingArea")}
        description={t("ui.units.fields.heatingAreaDescription")}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder={t("ui.units.fields.heatingAreaPlaceholder")}
        suffix="m²"
        optional={true}
      />
    </div>
  </FieldGroup>
);
