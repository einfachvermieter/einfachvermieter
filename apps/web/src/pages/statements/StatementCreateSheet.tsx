import {
  formatName,
  isoDatePlusOneYear,
  todayIso,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { DateInput } from "@/components/form/DateInput";
import { FormSheet } from "@/components/form/FormSheet";
import { MonthInput } from "@/components/form/MonthInput";
import { SelectInput } from "@/components/form/SelectInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { FieldGroup } from "@/components/ui/Field";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { dateToIso } from "../../lib/dateInput";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { type Statement, statementsQueryOptions } from "../../lib/statements";
import { tenantsOverviewQueryOptions } from "../../lib/tenants";
import { useCrudMutation } from "../../lib/useCrudMutation";
import {
  type StatementFormValues,
  statementFormSchema,
} from "./forms/statementForm.schema";

/**
 * Abrechnung anlegen im FormSheet: Mieter und Zeitraum. Erzeugen speichert
 * sofort und führt auf den Entwurf, wo gerechnet und finalisiert wird.
 */
export const StatementCreateSheet = ({ onClose }: { onClose: () => void }) => {
  const { buildingId } = useActiveBuilding();
  const navigate = useNavigate();

  const { data: tenantsResult } = useQuery(
    tenantsOverviewQueryOptions({ page: 0, pageSize: 1000 }),
  );
  const { data: statements } = useQuery(statementsQueryOptions);

  const currentYear = new Date().getFullYear();
  const form = useForm<StatementFormValues>({
    resolver: zodResolver(statementFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: {
      buildingId: buildingId ?? "",
      tenantId: "",
      periodStart: `${currentYear - 1}-01-01`,
      periodEnd: `${currentYear - 1}-12-31`,
      documentDate: dateToIso(new Date()),
    },
  });

  const tenantOptions = useMemo(
    () =>
      (tenantsResult?.items ?? [])
        .filter((tenant) => tenant.buildingId === buildingId)
        .map((tenant) => ({
          value: tenant.id,
          label:
            tenant.contractResidents.length > 0
              ? t("ui.tenants.summary", {
                  unit: tenant.unitName,
                  residents: tenant.contractResidents
                    .map((resident) =>
                      formatName(resident.firstName, resident.lastName),
                    )
                    .join(t("ui.common.separators.comma")),
                })
              : tenant.unitName,
        })),
    [tenantsResult, buildingId],
  );

  const periodStart = form.watch("periodStart");
  const periodEnd = form.watch("periodEnd");
  const tenantId = form.watch("tenantId");

  // Nach 12 Monaten ab Periodenende ist eine Nachforderung ausgeschlossen.
  // Nur warnen, nicht blockieren: Abrechnung über ein Guthaben bleibt sinnvoll.
  const deadlineMissed =
    periodEnd.length > 0 && todayIso() > isoDatePlusOneYear(periodEnd);

  // Nur Hinweis: zweiter Entwurf kann gewollt sein, aber eher Versehen
  const duplicateDraft =
    tenantId !== "" &&
    periodStart !== "" &&
    periodEnd !== "" &&
    (statements ?? []).some(
      (statement) =>
        statement.status === "draft" &&
        statement.tenantId === tenantId &&
        statement.periodStart <= periodEnd &&
        statement.periodEnd >= periodStart,
    );

  const createStatement = useCrudMutation({
    mutationFn: (values: StatementFormValues) =>
      api.post<Statement>("/statements", values),
    invalidateKeys: [["statements"], ["stats"]],
  });

  return (
    <FormSheet
      form={form}
      icon={domainVisuals.statements.icon}
      title={t("ui.statements.createTitle")}
      description={t("ui.statements.createDescription")}
      submitLabel={t("ui.common.action.generate")}
      onSubmit={async (values) => {
        const created = await createStatement.mutateAsync(values);
        // Direkt in den Entwurf; der Routenwechsel schließt das Sheet.
        await navigate({
          to: "/abrechnungen/$statementId",
          params: { statementId: created.id },
        });
      }}
      onClose={onClose}
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
      {duplicateDraft ? (
        <Alert variant="warning">
          <AlertTitle>{t("ui.statements.duplicateDraftTitle")}</AlertTitle>
          <AlertDescription>
            {t("ui.statements.duplicateDraftDescription")}
          </AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup className="gap-4">
        <SelectInput
          control={form.control}
          name="tenantId"
          label={t("ui.common.columns.tenant")}
          options={tenantOptions}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>
        <DateInput
          control={form.control}
          name="documentDate"
          label={t("ui.statements.fields.documentDate")}
          description={t("ui.statements.fields.documentDateHint")}
        />
      </FieldGroup>
    </FormSheet>
  );
};
