import type { MeterFormValues } from "@einfachvermieter/shared";
import { formatNumber } from "@einfachvermieter/shared";
import { RiFireLine } from "@remixicon/react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import {
  EditableListSection,
  type EditableListSectionRowFormProps,
} from "@/components/form/EditableListSection";
import { gradients } from "../../../../lib/domainVisuals";
import { formatPeriod } from "../../../../lib/format";
import { t, translateKey } from "../../../../lib/i18n";
import { GasFactorRowForm } from "./GasFactorRowForm";
import { emptyGasFactorRow, type GasFactorRowValues } from "./gasFactorRow";

const buildGasFactorSortIndex = (rows: GasFactorRowValues[]): number[] =>
  rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.validFrom.localeCompare(b.row.validFrom))
    .map((entry) => entry.index);

export const GasFactorsCard = ({
  form,
}: {
  form: UseFormReturn<MeterFormValues>;
}) => {
  const gasFactorsArray = useFieldArray({
    control: form.control,
    name: "gasFactors",
  });

  const watchedGasFactors = form.watch("gasFactors");
  const meterValidFrom = form.watch("validFrom");
  const error = translateKey(form.formState.errors.gasFactors?.message);

  const resolveDefaultValues = (
    _editIndex: number | null,
    current: GasFactorRowValues | undefined,
  ): GasFactorRowValues => {
    if (current) {
      return current;
    }
    return { ...emptyGasFactorRow(), validFrom: meterValidFrom };
  };

  const renderRowForm = ({
    defaultValues,
    editIndex,
    onSubmit,
    onCancel,
  }: EditableListSectionRowFormProps<GasFactorRowValues>) => (
    <GasFactorRowForm
      key={editIndex !== null ? `edit-${editIndex}` : "new"}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );

  return (
    <EditableListSection<GasFactorRowValues>
      title={t("ui.meters.gasFactors.title")}
      emptyHint={t("ui.meters.gasFactors.emptyHint")}
      addLabel={t("ui.meters.gasFactors.addPeriod")}
      icon={RiFireLine}
      iconBackground={gradients.heating}
      fieldKeys={gasFactorsArray.fields}
      rows={watchedGasFactors}
      renderRow={(row) => {
        const factorLabel =
          row.energyFactor === ""
            ? t("ui.meters.gasFactors.noFactor")
            : t("ui.meters.gasFactors.factorValue", {
                value: formatNumber(
                  Number.parseFloat(row.energyFactor.replace(",", ".")),
                ),
              });
        return (
          <>
            <p className="truncate font-semibold tabular-nums">{factorLabel}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatPeriod(row.validFrom, row.validUntil)}
            </p>
            {row.notes ? (
              <p className="truncate text-sm text-muted-foreground">
                {row.notes}
              </p>
            ) : null}
          </>
        );
      }}
      onAppend={(values) => gasFactorsArray.append(values)}
      onUpdate={(index, values) => gasFactorsArray.update(index, values)}
      onRemove={(index) => gasFactorsArray.remove(index)}
      resolveDefaultValues={resolveDefaultValues}
      renderRowForm={renderRowForm}
      confirmDeleteTitle={t("ui.meters.gasFactors.confirmRemovePeriod")}
      error={error}
      rowError={(index) =>
        translateKey(form.formState.errors.gasFactors?.[index]?.message)
      }
      sortIndex={buildGasFactorSortIndex}
    />
  );
};
