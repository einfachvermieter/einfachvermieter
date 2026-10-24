import type {
  SubstitutionScope,
  UnitSupplyExclusion,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiDropLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { TextareaInput } from "@/components/form/TextareaInput";
import { IconFlame } from "@/lib/icons";
import { t } from "../../../lib/i18n";
import {
  saveUnitSupplyExclusion,
  type UnitSupplyFormValues,
  unitSupplyFormSchema,
  unitSupplyFormToDto,
  unitSupplyInvalidateKeys,
} from "../../../lib/unitSupply";
import { useCrudMutation } from "../../../lib/useCrudMutation";

/**
 * Zeitraum ohne Versorgung aus der zentralen Anlage anlegen oder bearbeiten
 */
export const UnitSupplySheet = ({
  unitId,
  scopes,
  existing,
  onClose,
}: {
  unitId: string;
  scopes: SubstitutionScope[];
  existing: UnitSupplyExclusion | null;
  onClose: () => void;
}) => {
  const form = useForm<UnitSupplyFormValues>({
    resolver: zodResolver(unitSupplyFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: {
      scope: existing?.scope ?? scopes[0] ?? "heating",
      validFrom: existing?.validFrom ?? "",
      validUntil: existing?.validUntil ?? "",
      notes: existing?.notes ?? "",
    },
  });

  const save = useCrudMutation({
    mutationFn: (values: UnitSupplyFormValues) =>
      saveUnitSupplyExclusion(
        unitId,
        existing?.id ?? null,
        unitSupplyFormToDto(values),
      ),
    invalidateKeys: unitSupplyInvalidateKeys,
    onSuccess: onClose,
  });

  return (
    <FormSheet
      form={form}
      icon={IconFlame}
      // Wie der Abschnitt, aus dem das Sheet kommt
      title={t("ui.units.supply.title")}
      // Wann ein Eintrag hierher gehört, steht einmal unter dem Titel;
      // bei nur einem Bereich gibt es nichts zu fragen
      description={
        scopes.length === 1
          ? t(`ui.units.supply.singleScope.${existing?.scope ?? scopes[0]}`)
          : t("ui.units.supply.sheet.description")
      }
      submitLabel={t("ui.common.action.save")}
      onSubmit={async (values) => {
        await save.mutateAsync(values);
      }}
      onClose={onClose}
    >
      {scopes.length > 1 ? (
        <ChoiceTilesInput
          control={form.control}
          name="scope"
          label={t("ui.units.supply.fields.scope")}
          options={scopes.map((scope) => ({
            value: scope,
            icon: scope === "heating" ? IconFlame : RiDropLine,
            title: t(`ui.units.supply.scope.${scope}`),
            description: t(`ui.units.supply.scopeDescription.${scope}`),
          }))}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
        <DateInput
          control={form.control}
          name="validFrom"
          label={t("ui.units.supply.fields.validFrom")}
          labelHelp={t("ui.units.supply.fields.validFromHelp")}
        />
        <DateInput
          control={form.control}
          name="validUntil"
          label={t("ui.units.supply.fields.validUntil")}
          optional={true}
        />
      </div>
      <TextareaInput
        control={form.control}
        name="notes"
        label={t("ui.units.supply.fields.notes")}
        optional={true}
      />
    </FormSheet>
  );
};
