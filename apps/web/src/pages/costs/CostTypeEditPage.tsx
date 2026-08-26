import { formatDate, formatEur } from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiReceiptLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ActionLink } from "../../components/common/ActionLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { InfoCard } from "../../components/common/InfoCard";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { api } from "../../lib/api";
import {
  type CostType,
  type CostTypeDetail,
  costTypeCategoryLabel,
  costTypeQueryOptions,
} from "../../lib/costs";
import { domainVisuals } from "../../lib/domainVisuals";
import {
  heatingIdentityLabel,
  heatingSettingsListQueryOptions,
} from "../../lib/heating";
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
    isMeteringServiceCost: costType.isMeteringServiceCost,
  };
};

export const CostTypeEditPage = () => {
  const { costTypeId } = routeApi.useParams();

  const costTypeQuery = useQuery(costTypeQueryOptions(costTypeId));
  const { data: heatingVersions } = useQuery({
    ...heatingSettingsListQueryOptions(costTypeQuery.data?.buildingId ?? ""),
    enabled: costTypeQuery.data?.category === "heating",
  });

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
    invalidateKeys: [["costTypes"]],
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

  const costType = costTypeQuery.data;
  const isHeating = costType?.category === "heating";
  const [heatingVersion] = heatingVersions ?? [];

  return (
    <div className="pb-24">
      <PageHeader
        loading={!costType}
        statsSkeleton={3}
        tile={<PageHeaderIcon icon={domainVisuals.costTypes.icon} />}
        title={costType?.name ?? ""}
        sub={costType ? costTypeCategoryLabel(costType.category) : undefined}
        stats={
          costType
            ? [
                {
                  label: t("ui.costs.detail.statsEntries", {
                    year: costType.stats.year,
                  }),
                  value: String(costType.stats.entryCount),
                },
                {
                  label: t("ui.costs.detail.statsSum", {
                    year: costType.stats.year,
                  }),
                  value: formatEur(costType.stats.totalAmountCents),
                },
                {
                  label: t("ui.costs.columns.category"),
                  value: costTypeCategoryLabel(costType.category),
                },
              ]
            : undefined
        }
      />

      {costType ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] *:min-w-0">
          <CostTypeForm
            mode="edit"
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

          <div className="flex flex-col gap-6 xl:sticky xl:top-24">
            <InfoCard title={t("ui.common.infoCards.links")}>
              <ActionLink
                icon={RiReceiptLine}
                onClick={() =>
                  navigate({
                    to: "/rechnungen/neu",
                    search: { buildingId: costType.buildingId },
                  })
                }
              >
                {t("ui.costs.addEntry")}
              </ActionLink>
              {isHeating ? (
                heatingVersion && (
                  <ActionLink
                    icon={domainVisuals.heating.icon}
                    subtitle={heatingIdentityLabel(heatingVersion)}
                    onClick={() =>
                      navigate({
                        to: "/heizkosten/$id",
                        params: { id: heatingVersion.id },
                      })
                    }
                  >
                    {t("ui.costs.detail.openHeating")}
                  </ActionLink>
                )
              ) : (
                <ActionLink
                  icon={domainVisuals.meters.icon}
                  subtitle={t("ui.meters.sub.count", {
                    count: costType.stats.assignedMetersCount,
                  })}
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
              )}
            </InfoCard>

            <InfoCard
              title={t("ui.common.infoCards.details")}
              rows={[
                {
                  label: t("ui.costs.detail.lastEntryLabel"),
                  value: costType.stats.lastEntry ? (
                    <Link
                      to="/rechnungen/$costEntryId"
                      params={{ costEntryId: costType.stats.lastEntry.id }}
                      className="font-semibold text-limette-700"
                    >
                      {formatEur(costType.stats.lastEntry.amountCents)}
                    </Link>
                  ) : (
                    t("ui.common.emptyValue")
                  ),
                },
              ]}
            />

            <InfoCard title={t("ui.common.infoCards.actions")}>
              <ActionLink
                icon={RiDeleteBinLine}
                danger={true}
                onClick={() => deletion.request(costType)}
              >
                {t("ui.costs.detail.deleteAction")}
              </ActionLink>
            </InfoCard>
          </div>
        </div>
      ) : (
        <FormSkeleton rows={4} aside={true} />
      )}

      {deletion.dialog}
    </div>
  );
};
