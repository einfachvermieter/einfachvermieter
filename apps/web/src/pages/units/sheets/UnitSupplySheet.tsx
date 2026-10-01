import type {
  SubstitutionScope,
  UnitSupplyExclusion,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiFireLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { SelectInput } from "@/components/form/SelectInput";
import { TextareaInput } from "@/components/form/TextareaInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
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
      icon={RiFireLine}
      title={t(
        existing
          ? "ui.units.supply.sheet.titleEdit"
          : "ui.units.supply.sheet.titleNew",
      )}
      description={t("ui.units.supply.sheet.description")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={async (values) => {
        await save.mutateAsync(values);
      }}
      onClose={onClose}
    >
      <SelectInput
        control={form.control}
        name="scope"
        label={t("ui.units.supply.fields.scope")}
        options={scopes.map((scope) => ({
          value: scope,
          label: t(`ui.units.supply.scope.${scope}`),
        }))}
      />
      <DateInput
        control={form.control}
        name="validFrom"
        label={t("ui.units.supply.fields.validFrom")}
      />
      <DateInput
        control={form.control}
        name="validUntil"
        label={t("ui.units.supply.fields.validUntil")}
        description={t("ui.units.supply.fields.validUntilHint")}
        optional={true}
      />
      <TextareaInput
        control={form.control}
        name="notes"
        label={t("ui.units.supply.fields.notes")}
        optional={true}
      />
      <Alert variant="warning">
        <AlertDescription>
          {t("ui.units.supply.sheet.readingHint")}
        </AlertDescription>
      </Alert>
    </FormSheet>
  );
};
