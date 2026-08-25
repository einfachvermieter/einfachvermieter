import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BuildingContextCard } from "../../components/common/BuildingContextCard";
import { FormPage } from "../../components/common/FormPage";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { dateToIso } from "../../lib/dateInput";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { type Statement, statementsQueryOptions } from "../../lib/statements";
import { tenantsOverviewQueryOptions } from "../../lib/tenants";
import { useGoBack } from "../../lib/useGoBack";
import { StatementForm } from "./forms/StatementForm";
import type { StatementSubmitValues } from "./forms/statementForm.schema";

export const StatementCreatePage = () => {
  const queryClient = useQueryClient();
  const goBack = useGoBack("/abrechnungen");

  const { buildingId, building } = useActiveBuilding();
  const { data: tenantsResult } = useQuery(
    tenantsOverviewQueryOptions({ page: 0, pageSize: 1000 }),
  );
  const tenants = tenantsResult?.items ?? [];
  const { data: statements } = useQuery(statementsQueryOptions);
  const existingDrafts = (statements ?? []).filter(
    (statement) => statement.status === "draft",
  );

  const currentYear = new Date().getFullYear();

  const createStatement = useMutation({
    mutationFn: (dto: StatementSubmitValues) =>
      api.post<Statement>("/statements", dto),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["statements"] }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
      ]);
      goBack();
    },
  });

  return (
    <FormPage
      tile={<PageHeaderIcon icon={domainVisuals.statements.icon} />}
      title={t("ui.statements.createTitle")}
      description={t("ui.statements.createDescription")}
      aside={<BuildingContextCard building={building} />}
    >
      {buildingId ? (
        <StatementForm
          tenants={tenants}
          existingDrafts={existingDrafts}
          defaultValues={{
            buildingId,
            tenantId: "",
            periodStart: `${currentYear - 1}-01-01`,
            periodEnd: `${currentYear - 1}-12-31`,
            documentDate: dateToIso(new Date()),
          }}
          onSubmit={(values) => createStatement.mutate(values)}
          onCancel={goBack}
          submitting={createStatement.isPending}
        />
      ) : (
        <FormSkeleton rows={4} />
      )}
    </FormPage>
  );
};
