import {
  emptyTenantFormValues,
  type TenantSaveDto,
  todayIso,
} from "@einfachvermieter/shared";
import { RiInformationLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BuildingContextCard } from "../../components/common/BuildingContextCard";
import { FormPage } from "../../components/common/FormPage";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { TextWithLink } from "../../components/TextWithLink";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import type { TenantAggregate } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { TenantForm } from "./TenantForm";

export const TenantCreatePage = () => {
  const { buildingId } = useActiveBuilding();
  const { data: allUnits } = useQuery(unitsQueryOptions);
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const activeBuilding = buildings?.find((entry) => entry.id === buildingId);

  const units = (allUnits ?? []).filter(
    (unit) => unit.buildingId === buildingId,
  );

  const goToList = useGoBack("/mieter", { search: { buildingId: undefined } });

  const createTenant = useCrudMutation({
    mutationFn: (dto: TenantSaveDto) =>
      api.post<TenantAggregate>("/tenants", dto),
    invalidateKeys: [["tenants"], ["stats"]],
    onSuccess: goToList,
  });

  const hasUnits = units.length > 0;

  // "frei ab" zählt mit: für diese Wohnungen lässt sich bereits ein
  // Mietverhältnis mit späterem Beginn anlegen
  const vacantUnits = units.filter(
    (unit) =>
      unit.occupancy.status === "vacant" ||
      unit.occupancy.status === "vacant_from",
  ).length;
  const today = todayIso();

  return (
    <FormPage
      tile={<PageHeaderIcon icon={domainVisuals.tenants.icon} />}
      title={t("ui.tenants.createTitle")}
      aside={
        <BuildingContextCard
          building={activeBuilding}
          extraRows={[
            {
              label: t("ui.units.vacantCount"),
              value: allUnits ? vacantUnits : t("ui.common.emptyValue"),
            },
          ]}
        />
      }
    >
      {hasUnits ? (
        <TenantForm
          mode="create"
          units={units ?? []}
          defaultValues={emptyTenantFormValues(today)}
          onSubmit={async (values) => {
            await createTenant.mutateAsync(values);
          }}
          onCancel={goToList}
        />
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <RiInformationLine className="mt-0.5 size-4 shrink-0" />
          <span>
            <TextWithLink
              template={t("ui.tenants.noUnits")}
              link={
                <Link
                  to="/wohnungen"
                  search={{ buildingId }}
                  className="font-semibold text-foreground underline"
                >
                  {t("ui.units.title")}
                </Link>
              }
            />
          </span>
        </div>
      )}
    </FormPage>
  );
};
