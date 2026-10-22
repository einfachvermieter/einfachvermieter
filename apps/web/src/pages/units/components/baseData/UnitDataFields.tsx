import { todayIso, type UnitFormValues } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import { TextInput } from "@/components/form/TextInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import { heatingSettingsListQueryOptions } from "../../../../lib/heating";
import { t } from "../../../../lib/i18n";

export const UnitDataFields = ({
  form,
  savedHeatingArea,
}: {
  form: UseFormReturn<UnitFormValues>;
  savedHeatingArea?: string;
}) => {
  const toNumber = (value: string) =>
    Number.parseFloat(value.replace(",", "."));
  const area = toNumber(form.watch("areaSqm"));
  const heatingArea = toNumber(form.watch("heatingAreaSqm"));
  const buildingId = form.watch("buildingId");

  const { data: heatingVersions } = useQuery({
    ...heatingSettingsListQueryOptions(buildingId),
    enabled: buildingId.length > 0,
  });
  const today = todayIso();
  const currentHeating = heatingVersions?.find(
    (version) =>
      version.validFrom <= today &&
      (version.validTo === null || version.validTo >= today),
  );
  // Beim Maßstab Wohnfläche hätte eine Eingabe sonst ohne sichtbaren Grund
  // keine Wirkung.
  const heatingAreaUnused =
    currentHeating?.mode === "internal" &&
    currentHeating.baseMethod === "living_area";

  // Möglich (z.B. beheizter Keller), aber selten genug für einen Hinweis:
  // eine zu große Heizfläche verzerrt die Heizkostenverteilung still.
  const heatingAreaLarger =
    Number.isFinite(area) &&
    Number.isFinite(heatingArea) &&
    area > 0 &&
    heatingArea > area;

  // Die Heizfläche hat keine Historie: Eine Änderung wirkt auch auf alle
  // offenen Abrechnungen früherer Zeiträume. Object.is, damit zweimal leer
  // (NaN) als gleich gilt.
  const heatingAreaChanged =
    savedHeatingArea !== undefined &&
    !Object.is(heatingArea, toNumber(savedHeatingArea));

  return (
    <FieldGroup className="gap-5">
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
          inputMode="decimal"
          placeholder={t("ui.units.fields.areaPlaceholder")}
          suffix="m²"
        />
        <TextInput
          control={form.control}
          name="heatingAreaSqm"
          label={t("ui.units.fields.heatingArea")}
          description={t("ui.units.fields.heatingAreaDescription")}
          labelHelp={t("ui.units.fields.heatingAreaHelp")}
          inputMode="decimal"
          placeholder={t("ui.units.fields.heatingAreaPlaceholder")}
          suffix="m²"
          optional={true}
        />
      </div>
      {heatingAreaUnused ? (
        <Alert variant="info">
          <AlertDescription>
            {t("ui.units.fields.heatingAreaUnusedHint")}
          </AlertDescription>
        </Alert>
      ) : null}
      {heatingArea === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            {t("ui.units.fields.heatingAreaZeroHint")}
          </AlertDescription>
        </Alert>
      ) : null}
      {heatingAreaChanged ? (
        <Alert variant="warning">
          <AlertDescription>
            {t("ui.units.fields.heatingAreaChangedHint")}
          </AlertDescription>
        </Alert>
      ) : null}
      {heatingAreaLarger ? (
        <Alert variant="warning">
          <AlertDescription>
            {t("ui.units.fields.heatingAreaLargerWarning")}
          </AlertDescription>
        </Alert>
      ) : null}
    </FieldGroup>
  );
};
