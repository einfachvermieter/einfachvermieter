import { formatDate, formatEur } from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiMoreLine, RiPriceTag3Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { DomainLink } from "../../components/common/DomainLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { MiniKpiRow } from "../../components/common/MiniKpiRow";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Button } from "../../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
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
import { costTypeVisual } from "../../lib/domainVisuals";
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
  // Verteilerschlüssel, die das Formular nicht abbildet (z. B. das noch nicht
  // implementierte `per_consumption_kwh`), fallen auf "kein Schlüssel" zurück.
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
        .join(t("ui.common.separators.bullet")),
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
      t("ui.costs.confirmDeleteTypeMessage", { name: target.name }),
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
          tile={<PageHeaderIcon icon={RiPriceTag3Line} />}
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
          tile={<PageHeaderIcon icon={costTypeVisual(costType).icon} />}
          title={costType.name}
          sub={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {[
                  costTypeCategoryLabel(costType.category),
                  costTypeAllocationText(costType),
                ].join(t("ui.common.separators.bullet"))}
              </span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild={true}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("ui.common.a11y.more")}
                >
                  <RiMoreLine />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => deletion.request(costType)}
                >
                  <RiDeleteBinLine />
                  {t("ui.costs.detail.deleteAction")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <div className="space-y-5">
          <MiniKpiRow
            columns={showMeters ? 2 : 1}
            items={[
              {
                label: t("ui.costs.detail.statsEntries", { year: stats.year }),
                value: formatEur(stats.totalAmountCents),
                hint:
                  stats.entryCount > 0 && stats.lastEntry
                    ? t("ui.costs.detail.entriesHint", {
                        count: stats.entryCount,
                        date: formatDate(stats.lastEntry.invoiceDate),
                      })
                    : t("ui.costs.detail.entriesEmptyYear"),
              },
              ...(showMeters
                ? [
                    {
                      label: t("ui.costs.detail.metersSection"),
                      value: t("ui.meters.sub.count", {
                        count: stats.assignedMetersCount,
                      }),
                    },
                  ]
                : []),
            ]}
          />

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
