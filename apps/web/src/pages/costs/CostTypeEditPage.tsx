import { formatDate, formatEur } from "@einfachvermieter/shared";
import { RiBillLine, RiDeleteBinLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ActionLink } from "../../components/common/ActionLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { HeroBand } from "../../components/common/HeroBand";
import { IconTile } from "../../components/common/IconTile";
import { InfoCard } from "../../components/common/InfoCard";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Badge } from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import {
  allocationLabel,
  type CostType,
  type CostTypeDetail,
  costTypeCategoryLabel,
  costTypeQueryOptions,
} from "../../lib/costs";
import { costTypeVisual, domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { useGoBack } from "../../lib/useGoBack";
import { CostTypeForm } from "./components/baseData/CostTypeForm";
import {
  ALLOCATION_KEY_NONE,
  type CostTypeFormValues,
  type CostTypeSubmitValues,
  costTypeAllocationKeySchema,
  LABOR_CATEGORY_NONE,
} from "./components/baseData/costTypeForm.schema";

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
  };
};

export const CostTypeEditPage = () => {
  const { costTypeId } = routeApi.useParams();

  const { data: buildings } = useQuery(buildingsQueryOptions);
  const costTypeQuery = useQuery(costTypeQueryOptions(costTypeId));

  const goBack = useGoBack("/kostenarten");
  const navigate = useNavigate();

  const updateCostType = useCrudMutation({
    mutationFn: ({ buildingId: _ignored, ...dto }: CostTypeSubmitValues) =>
      api.patch<CostType>(`/costs/types/${costTypeId}`, dto),
    invalidateKeys: [["costTypes"], ["costType", costTypeId]],
    onSuccess: goBack,
  });

  const deletion = useDeleteResource<CostTypeDetail>({
    endpoint: (target) => `/costs/types/${target.id}`,
    invalidateKey: ["costTypes"],
    title: t("ui.costs.confirmDeleteType"),
    describe: (target) =>
      t("ui.costs.confirmDeleteTypeMessage", { name: target.name }),
    onDeleted: goBack,
  });

  if (
    costTypeQuery.isError ||
    (costTypeQuery.data === undefined && !costTypeQuery.isLoading)
  ) {
    return (
      <EntityNotFound
        title={t("ui.costs.notFound.title")}
        description={t("ui.costs.notFound.description")}
        to="/kostenarten"
      />
    );
  }

  if (!buildings || !costTypeQuery.data) {
    return <FormSkeleton rows={4} />;
  }

  const costType = costTypeQuery.data;
  const { stats } = costType;
  const visual = costTypeVisual(costType);

  return (
    <div className="pb-24">
      <HeroBand
        tile={
          <IconTile icon={visual.icon} size={64} background={visual.gradient} />
        }
        eyebrow={t("ui.costs.typeEditTitle")}
        title={costType.name}
        meta={costTypeCategoryLabel(costType.category)}
        stats={[
          {
            label: t("ui.costs.detail.statsEntries", { year: stats.year }),
            value: String(stats.entryCount),
          },
          {
            label: t("ui.costs.detail.statsSum", { year: stats.year }),
            value: formatEur(stats.totalAmountCents),
          },
          {
            label: t("ui.costs.columns.category"),
            value: costTypeCategoryLabel(costType.category),
          },
        ]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <CostTypeForm
          mode="edit"
          buildings={buildings}
          savedAt={
            costType.updatedAt
              ? formatDate(costType.updatedAt.slice(0, 10))
              : undefined
          }
          defaultValues={toFormValues(costType)}
          onSubmit={async (values) => {
            await updateCostType.mutateAsync(values);
          }}
          onCancel={goBack}
        />

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <InfoCard
            title={t("ui.common.infoCards.atAGlance")}
            rows={[
              {
                label: t("ui.costs.columns.category"),
                value: (
                  <Badge
                    variant={costType.category === "heating" ? "warn" : "blue"}
                  >
                    {costTypeCategoryLabel(costType.category)}
                  </Badge>
                ),
              },
              {
                label: t("ui.costs.columns.allocation"),
                value: costType.defaultAllocationKey
                  ? allocationLabel(costType.defaultAllocationKey)
                  : t("ui.common.emptyValue"),
              },
              {
                label: t("ui.costs.detail.metersLabel"),
                value: t("ui.costs.detail.metersAssigned", {
                  count: stats.assignedMetersCount,
                }),
              },
              {
                label: t("ui.costs.detail.lastEntryLabel"),
                value: stats.lastEntry ? (
                  <Link
                    to="/rechnungen/$costEntryId"
                    params={{ costEntryId: stats.lastEntry.id }}
                    className="font-semibold text-sky-700 dark:text-sky-400"
                  >
                    {formatEur(stats.lastEntry.amountCents)}
                  </Link>
                ) : (
                  t("ui.common.emptyValue")
                ),
              },
            ]}
          />

          <InfoCard title={t("ui.common.infoCards.actions")}>
            <ActionLink
              icon={RiBillLine}
              iconBackground={domainVisuals.invoices.accent}
              onClick={() =>
                navigate({
                  to: "/rechnungen/neu",
                  search: { buildingId: costType.buildingId },
                })
              }
            >
              {t("ui.costs.addEntry")}
            </ActionLink>
            <ActionLink
              icon={domainVisuals.meters.icon}
              iconBackground={domainVisuals.meters.accent}
              onClick={() =>
                navigate({
                  to: "/zaehler",
                  search: {
                    buildingId: costType.buildingId,
                    unitId: undefined,
                    type: undefined,
                  },
                })
              }
            >
              {t("ui.costs.detail.openMeters")}
            </ActionLink>
            <ActionLink
              icon={RiDeleteBinLine}
              iconBackground="var(--color-rose-400)"
              danger={true}
              onClick={() => deletion.request(costType)}
            >
              {t("ui.costs.detail.deleteAction")}
            </ActionLink>
          </InfoCard>
        </div>
      </div>

      {deletion.dialog}
    </div>
  );
};
