import {
  formatName,
  isoDatePlusOneYear,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { MonthInput } from "@/components/form/MonthInput";
import { Savebar } from "@/components/form/Savebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/Field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { Building } from "../../../lib/buildings";
import { t } from "../../../lib/i18n";
import type { TenantOverviewRow } from "../../../lib/tenants";
import {
  type StatementFormValues,
  type StatementSubmitValues,
  statementFormSchema,
} from "./statementForm.schema";

export const StatementForm = ({
  buildings,
  tenants,
  defaultValues,
  onSubmit,
  onCancel,
  submitting = false,
  onBuildingChange,
}: {
  buildings: Building[];
  tenants: TenantOverviewRow[];
  defaultValues: StatementFormValues;
  onSubmit: (values: StatementSubmitValues) => void;
  onCancel: () => void;
  submitting?: boolean;

  /**
   * Meldet die aktuelle Gebäude-Auswahl nach außen, damit die
   * Kontext-Karte der Anlege-Seite dem Wechsel folgt
   */
  onBuildingChange?: (buildingId: string) => void;
}) => {
  const formId = useId();
  const form = useForm<StatementFormValues>({
    resolver: zodResolver(statementFormSchema),
    defaultValues,
  });

  const selectedBuildingId = form.watch("buildingId");
  useEffect(() => {
    onBuildingChange?.(selectedBuildingId);
  }, [onBuildingChange, selectedBuildingId]);

  const scopedTenants = useMemo(
    () => tenants.filter((tenant) => tenant.buildingId === selectedBuildingId),
    [tenants, selectedBuildingId],
  );

  // 12 Monaten ab Periodenende ist Nachforderung ausgeschlossen.
  // Nur warnen, nicht blockieren. Abrechnung über ein Guthaben bleibt sinnvoll.
  const periodEnd = form.watch("periodEnd");
  const deadlineMissed =
    periodEnd.length > 0 && todayIso() > isoDatePlusOneYear(periodEnd);

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
    >
      {deadlineMissed ? (
        <Alert variant="warning">
          <AlertTitle>
            {t("ui.statements.fields.deadlineWarningTitle")}
          </AlertTitle>
          <AlertDescription>
            {t("ui.statements.fields.deadlineWarningDescription")}
          </AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup className="gap-4">
        <Controller
          name="buildingId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-buildingId`}>
                {t("ui.buildings.title")}
              </FieldLabel>
              <Select
                name={field.name}
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue("tenantId", "");
                }}
              >
                <SelectTrigger
                  id={`${formId}-buildingId`}
                  aria-invalid={fieldState.invalid}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {buildings.map((building) => (
                    <SelectItem key={building.id} value={building.id}>
                      {building.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Controller
          name="tenantId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-tenantId`}>
                {t("ui.common.columns.tenant")}
              </FieldLabel>
              <Select
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  id={`${formId}-tenantId`}
                  aria-invalid={fieldState.invalid}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {scopedTenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.contractResidents.length > 0
                        ? t("ui.tenants.summary", {
                            unit: tenant.unitName,
                            residents: tenant.contractResidents
                              .map((r) => formatName(r.firstName, r.lastName))
                              .join(", "),
                          })
                        : tenant.unitName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <MonthInput
          control={form.control}
          name="periodStart"
          label={t("ui.costs.entryFields.periodFrom")}
          boundary="start"
        />
        <MonthInput
          control={form.control}
          name="periodEnd"
          label={t("ui.costs.entryFields.periodTo")}
          boundary="end"
        />
        <DateInput
          control={form.control}
          name="documentDate"
          label={t("ui.statements.fields.documentDate")}
          description={t("ui.statements.fields.documentDateHint")}
        />
      </FieldGroup>
      <Savebar
        submitting={submitting}
        onCancel={onCancel}
        submitLabel={t("ui.common.action.generate")}
      />
    </form>
  );
};
