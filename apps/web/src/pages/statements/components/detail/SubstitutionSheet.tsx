import type { ConsumptionSubstitution, Period } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiErrorWarningLine, RiFlaskLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { FormSheet } from "@/components/form/FormSheet";
import { SheetSection } from "@/components/form/SheetSection";
import { Button } from "@/components/ui/Button";
import { formatPeriod } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";
import {
  initialSubstitutionFormValues,
  isWholeUnit,
  type SubstitutionFormValues,
  type SubstitutionSheetTarget,
  substitutionFormSchema,
  substitutionFormToDto,
  useDebounced,
} from "../../../../lib/substitutionForm";
import {
  createSubstitution,
  formatSubstituteConsumption,
  substitutionOptionsQueryOptions,
  substitutionPreviewQueryOptions,
  updateSubstitution,
} from "../../../../lib/substitutions";
import { useCrudMutation } from "../../../../lib/useCrudMutation";
import { useDeleteResource } from "../../../../lib/useDeleteResource";
import { SubstitutionCaseFields } from "./SubstitutionCaseFields";
import { SubstitutionMethodFields } from "./SubstitutionMethodFields";
import { SubstitutionPreviewAlert } from "./SubstitutionPreviewAlert";

const invalidateKeys = [["substitutions"], ["statement-preview"]] as const;

/**
 * Erfassungsausfall nach § 9a HeizkostenV anlegen oder bearbeiten. Die App
 * wählt weder Verfahren noch Vergleichszeitraum vor; sie zeigt nur, was mit
 * den vorhandenen Daten rechenbar ist, und rechnet eine Vorschau.
 */
export const SubstitutionSheet = ({
  buildingId,
  period,
  target,
  onClose,
}: {
  buildingId: string;
  period: Period;
  target: SubstitutionSheetTarget;
  onClose: () => void;
}) => {
  const existing = target.kind === "edit" ? target.record : null;
  const form = useForm<SubstitutionFormValues>({
    resolver: zodResolver(substitutionFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: initialSubstitutionFormValues(target, period),
  });
  const values = useWatch({ control: form.control }) as SubstitutionFormValues;

  const { data: options } = useQuery(
    substitutionOptionsQueryOptions(buildingId, {
      unitId: values.unitId,
      scope: values.scope,
      period,
      meterIds: values.affectedMeterIds,
    }),
  );

  // Erst rechnen, wenn die Angaben für das Verfahren vollständig sind; sonst
  // lehnt der Server die Vorschau ab.
  const complete =
    values.unitId !== "" &&
    values.reason !== "" &&
    values.method !== "" &&
    values.affectedMeterIds.length > 0 &&
    (values.method !== "same_rooms_comparable_period" ||
      values.referenceYears !== "") &&
    (values.scope !== "heating" ||
      isWholeUnit(values, options) ||
      values.affectedAreaSqm.trim() !== "");

  const previewDto = useDebounced(
    complete ? substitutionFormToDto(values, options, period) : null,
    400,
  );

  const { data: preview } = useQuery(
    substitutionPreviewQueryOptions(
      buildingId,
      previewDto,
      existing?.id ?? null,
    ),
  );

  const save = useCrudMutation({
    mutationFn: (formValues: SubstitutionFormValues) => {
      const payload = substitutionFormToDto(formValues, options, period);
      return existing
        ? updateSubstitution(existing.id, payload)
        : createSubstitution(buildingId, payload);
    },
    invalidateKeys,
    onSuccess: onClose,
  });

  const remove = useDeleteResource<ConsumptionSubstitution>({
    endpoint: (resource) => `/consumption-substitutions/${resource.id}`,
    invalidateKeys,
    title: t("ui.substitutions.sheet.delete"),
    describe: (resource) =>
      t("ui.substitutions.sheet.deleteDescription", {
        unit:
          target.units.find((unit) => unit.id === resource.unitId)?.name ?? "",
      }),
    onDeleted: onClose,
  });

  return (
    <FormSheet
      form={form}
      icon={RiErrorWarningLine}
      title={t(
        existing
          ? "ui.substitutions.sheet.titleEdit"
          : "ui.substitutions.sheet.titleNew",
      )}
      description={t("ui.substitutions.sheet.description", {
        period: formatPeriod(period.start, period.end),
      })}
      submitLabel={t("ui.common.action.save")}
      onSubmit={async (formValues) => {
        await save.mutateAsync(formValues);
      }}
      onClose={onClose}
      footerStart={
        existing ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => remove.request(existing)}
          >
            {t("ui.substitutions.sheet.delete")}
          </Button>
        ) : undefined
      }
    >
      <SheetSection
        icon={RiErrorWarningLine}
        title={t("ui.substitutions.sheet.sectionCase")}
        divider={false}
      >
        <SubstitutionCaseFields
          form={form}
          values={values}
          options={options}
          target={target}
        />
      </SheetSection>
      <SheetSection
        icon={RiFlaskLine}
        title={t("ui.substitutions.sheet.sectionMethod")}
      >
        {options ? (
          <SubstitutionMethodFields
            form={form}
            values={values}
            options={options}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("ui.substitutions.sheet.chooseUnitFirst")}
          </p>
        )}
        <SubstitutionPreviewAlert
          preview={preview}
          formatAmount={(value) =>
            formatSubstituteConsumption(
              value,
              values.scope,
              options?.shareMethod === true,
            )
          }
        />
      </SheetSection>
      {remove.dialog}
    </FormSheet>
  );
};
