import { todayIso, type UnitFormValues } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { SheetSection } from "@/components/form/SheetSection";
import { SwitchInput } from "@/components/form/SwitchInput";
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

  const heatingAreaDiffers = useWatch({
    control: form.control,
    name: "heatingAreaDiffers",
  });

  // Möglich (z.B. beheizter Keller), aber selten genug für einen Hinweis:
  // eine zu große Heizfläche verzerrt die Heizkostenverteilung still.
  const heatingAreaLarger =
    Number.isFinite(area) &&
    Number.isFinite(heatingArea) &&
    area > 0 &&
    heatingArea > area;

  // Ohne Abweichung gilt die Wohnfläche, gespeichert wird dann keine
  // Heizfläche (leer, als Zahl NaN)
  const effectiveHeatingArea = heatingAreaDiffers ? heatingArea : Number.NaN;

  // Die Heizfläche hat keine Historie: Eine Änderung wirkt auch auf alle
  // offenen Abrechnungen früherer Zeiträume. Object.is, damit zweimal leer
  // (NaN) als gleich gilt.
  const heatingAreaChanged =
    savedHeatingArea !== undefined &&
    !Object.is(effectiveHeatingArea, toNumber(savedHeatingArea));

  return (
    <FieldGroup>
      <SheetSection divider={false}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
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
            labelHelp={t("ui.units.fields.unitNumberHelp")}
            placeholder={t("ui.units.fields.unitNumberPlaceholder")}
            optional={true}
          />
          <TextInput
            control={form.control}
            name="areaSqm"
            label={t("ui.units.fields.area")}
            inputMode="decimal"
            suffix={t("ui.common.unitSymbols.sqm")}
          />
        </div>
      </SheetSection>
      {/* Verteilt das Gebäude nach Wohnfläche, spielt die Heizfläche keine
          Rolle; dann wird nicht danach gefragt, außer es steht schon eine
          da. Frage und Feld stehen in einer eigenen Gruppe, damit sie als
          zusammengehörig erkennbar sind */}
      {heatingAreaUnused && !heatingAreaDiffers ? null : (
        <SheetSection title={t("ui.units.fields.heatingArea")}>
          <SwitchInput
            control={form.control}
            name="heatingAreaDiffers"
            label={t("ui.units.fields.heatingAreaDiffers")}
            labelHelp={t("ui.units.fields.heatingAreaHelp")}
          />
          {heatingAreaDiffers ? (
            <TextInput
              control={form.control}
              name="heatingAreaSqm"
              label={t("ui.units.fields.heatingArea")}
              inputMode="decimal"
              suffix={t("ui.common.unitSymbols.sqm")}
            />
          ) : null}
          {heatingAreaDiffers && heatingAreaUnused ? (
            <Alert variant="info">
              <AlertDescription>
                {t("ui.units.fields.heatingAreaUnusedHint")}
              </AlertDescription>
            </Alert>
          ) : null}
          {effectiveHeatingArea === 0 ? (
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
          {heatingAreaDiffers && heatingAreaLarger ? (
            <Alert variant="warning">
              <AlertDescription>
                {t("ui.units.fields.heatingAreaLargerWarning")}
              </AlertDescription>
            </Alert>
          ) : null}
        </SheetSection>
      )}
    </FieldGroup>
  );
};
