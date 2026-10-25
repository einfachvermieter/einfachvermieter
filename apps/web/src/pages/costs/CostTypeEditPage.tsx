import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageDeleteAction } from "@/components/common/PageDeleteAction";
import { DomainLink } from "../../components/common/DomainLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { useAdoptBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import {
  type CostType,
  type CostTypeDetail,
  costCategoryFor,
  costTypeAllocationText,
  costTypeCategoryLabel,
  costTypeEntriesQueryOptions,
  costTypeQueryOptions,
} from "../../lib/costs";
import { t } from "../../lib/i18n";
import {
  type Meter,
  meterRoleLabel,
  metersOverviewQueryOptions,
} from "../../lib/meters";
import { type Unit, unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { CostEntryCreateSheet } from "../invoices/CostEntryCreateSheet";
import { CostTypeBaseCard } from "./cards/CostTypeBaseCard";
import { CostTypeEntriesCard } from "./cards/CostTypeEntriesCard";
import { CostTypeMetersCard } from "./cards/CostTypeMetersCard";
import {
  ALLOCATION_KEY_NONE,
  type CostTypeFormValues,
  type CostTypeSubmitValues,
  costTypeAllocationKeySchema,
  LABOR_CATEGORY_NONE,
} from "./components/baseData/costTypeForm.schema";
import { CostTypeSheet } from "./sheets/CostTypeSheet";

const routeApi = getRouteApi("/kostenarten/$costTypeId");

const toFormValues = (costType: CostType): CostTypeFormValues => {
  // Verteilerschlüssel, die das Formular nicht abbildet, fallen auf "kein
  // Schlüssel" zurück.
  const allocationKey = costTypeAllocationKeySchema.safeParse(
    costType.defaultAllocationKey ?? ALLOCATION_KEY_NONE,
  );

  return {
    buildingId: costType.buildingId,
    name: costType.name,
    category: costType.category,
    defaultAllocationKey: allocationKey.success
      ? allocationKey.data
      : ALLOCATION_KEY_NONE,
    laborCostCategory: costType.laborCostCategory ?? LABOR_CATEGORY_NONE,
    co2Tracked: costType.co2Tracked,
    isMeteringServiceCost: costType.isMeteringServiceCost,
  };
};

/**
 * Zähler, die dieser Kostenart zugeordnet sind, mit Wohnung und Rolle
 * als zweiter Zeile
 */
const metersOfCostType = (
  meters: Meter[],
  costTypeId: string,
  units: Unit[],
): { id: string; label: string; sub: string }[] =>
  meters
    .filter((meter) => meter.costTypeIds.includes(costTypeId))
    .map((meter) => ({
      id: meter.id,
      label: meter.label,
      sub: [
        units.find((unit) => unit.id === meter.unitId)?.name,
        meterRoleLabel(meter.role),
      ]
        .filter(Boolean)
        .join(t("ui.common.separators.comma")),
    }));

/**
 * Kostenart-Ansicht: Kopf, Kennzahlen, Stammdaten als Werte-Card sowie die
 * Rechnungen und Verbrauchsquellen dieser Kostenart
 */
export const CostTypeEditPage = () => {
  const { costTypeId } = routeApi.useParams();

  // Aus der Query statt aus den Loader-Daten: nach dem Speichern im Sheet
  // steht der neue Stand sofort in der Ansicht.
  const costTypeQuery = useQuery(costTypeQueryOptions(costTypeId));
  const costType = costTypeQuery.data;

  // Beim Direkteinstieg das Gebäude des Objekts übernehmen
  useAdoptBuilding(costType?.buildingId);

  const { data: entries } = useQuery(costTypeEntriesQueryOptions(costTypeId));
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: meterPage } = useQuery({
    ...metersOverviewQueryOptions({
      page: 0,
      pageSize: 1000,
      buildingId: costType?.buildingId,
    }),
    enabled: costType !== undefined,
  });

  const navigate = useNavigate();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);

  const updateCostType = useCrudMutation({
    mutationFn: ({ buildingId: _ignored, ...dto }: CostTypeSubmitValues) =>
      api.patch<CostType>(`/costs/types/${costTypeId}`, dto),
    invalidateKeys: [["costTypes"], ["costType", costTypeId]],
  });

  const deletion = useDeleteResource<CostTypeDetail>({
    endpoint: (target) => `/costs/types/${target.id}`,
    invalidateKeys: [["costTypes"], ["stats"]],
    title: t("ui.costs.confirmDeleteType"),
    describe: (target) =>
      t("ui.costs.confirmDeleteTypeQuestion", { name: target.name }),
    hint: t("ui.costs.confirmDeleteTypeHint"),
    onDeleted: () =>
      navigate({
        to: "/kostenarten",
        search: { buildingId: costType?.buildingId },
      }),
  });

  if (
    costTypeQuery.isError ||
    (costType === undefined && !costTypeQuery.isLoading)
  ) {
    return (
      <EntityNotFound
        title={t("ui.costs.notFound.title")}
        description={t("ui.costs.notFound.description")}
        to="/kostenarten"
      />
    );
  }

  if (!costType) {
    return (
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon domain="costTypes" />}
          title=""
          loading={true}
        />
        <FormSkeleton rows={4} />
      </div>
    );
  }

  const isHeating = costType.category === "heating";
  const { stats } = costType;

  const assignedMeters = metersOfCostType(
    meterPage?.items ?? [],
    costTypeId,
    units ?? [],
  );

  const showMeters =
    costCategoryFor(costType.category, costType.defaultAllocationKey) ===
      "byConsumption" || stats.assignedMetersCount > 0;

  return (
    <>
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon domain="costTypes" />}
          title={costType.name}
          sub={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
              <span>{costTypeCategoryLabel(costType.category)}</span>
              <span>{costTypeAllocationText(costType)}</span>
              {isHeating ? (
                <DomainLink
                  to="/heizkosten"
                  search={{ buildingId: costType.buildingId }}
                >
                  {t("ui.costs.detail.heatingLink")}
                </DomainLink>
              ) : null}
            </span>
          }
          action={
            <PageDeleteAction onClick={() => deletion.request(costType)} />
          }
        />

        <div className="space-y-5">
          <div>
            <CostTypeBaseCard
              costType={costType}
              onEdit={() => setSheetOpen(true)}
            />

            <CostTypeEntriesCard
              rows={entries ?? []}
              onAdd={() => setEntrySheetOpen(true)}
            />

            {showMeters ? (
              <CostTypeMetersCard
                meters={assignedMeters}
                buildingId={costType.buildingId}
              />
            ) : null}
          </div>
        </div>
      </div>

      {sheetOpen ? (
        <CostTypeSheet
          mode="edit"
          defaultValues={toFormValues(costType)}
          onSubmit={async (values) => {
            await updateCostType.mutateAsync(values);

            await router.invalidate();
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      {entrySheetOpen ? (
        <CostEntryCreateSheet
          costTypeId={costTypeId}
          onClose={() => setEntrySheetOpen(false)}
        />
      ) : null}

      {deletion.dialog}
    </>
  );
};
