import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BuildingContextCard } from "../../components/common/BuildingContextCard";
import { FormPage } from "../../components/common/FormPage";
import { IconTile } from "../../components/common/IconTile";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { dateToIso } from "../../lib/dateInput";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import type { Statement } from "../../lib/statements";
import { tenantsOverviewQueryOptions } from "../../lib/tenants";
import { useGoBack } from "../../lib/useGoBack";
import { StatementForm } from "./forms/StatementForm";
import type {
  StatementFormValues,
  StatementSubmitValues,
} from "./forms/statementForm.schema";

export const StatementCreatePage = () => {
  const queryClient = useQueryClient();
  const goBack = useGoBack("/abrechnungen");

  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { data: tenantsResult } = useQuery(
    tenantsOverviewQueryOptions({ page: 0, pageSize: 1000 }),
  );
  const tenants = tenantsResult?.items ?? [];

  // Gebäude-Auswahl aus dem Formular, für die Kontext-Karte
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>();
  const contextBuilding =
    buildings?.find((building) => building.id === selectedBuildingId) ??
    buildings?.[0];

  const currentYear = new Date().getFullYear();
  const defaultValues: StatementFormValues = {
    buildingId: buildings?.[0]?.id ?? "",
    tenantId: "",
    periodStart: `${currentYear - 1}-01-01`,
    periodEnd: `${currentYear - 1}-12-31`,
    documentDate: dateToIso(new Date()),
  };

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
      tile={
        <IconTile
          icon={domainVisuals.statements.icon}
          size={44}
          background={gradients.statements}
        />
      }
      title={t("ui.statements.createTitle")}
      description={t("ui.statements.createDescription")}
      aside={<BuildingContextCard building={contextBuilding} />}
    >
      <Card>
        <CardContent className="py-6">
          <StatementForm
            key={defaultValues.buildingId}
            buildings={buildings ?? []}
            tenants={tenants}
            defaultValues={defaultValues}
            onSubmit={(values) => createStatement.mutate(values)}
            onCancel={goBack}
            submitting={createStatement.isPending}
            onBuildingChange={setSelectedBuildingId}
          />
        </CardContent>
      </Card>
    </FormPage>
  );
};
