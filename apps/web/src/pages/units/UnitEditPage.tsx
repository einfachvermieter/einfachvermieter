import {
  decimalToInput,
  formatName,
  formatNumber,
  type UnitCreateDto,
} from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageDeleteAction } from "@/components/common/PageDeleteAction";
import { SectionAction } from "@/components/common/SectionAction";
import { DomainLink } from "../../components/common/DomainLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { ResultRows } from "../../components/common/ResultRows";
import { SectionCard } from "../../components/common/SectionCard";
import { Badge } from "../../components/ui/Badge";
import { useAdoptBuilding } from "../../lib/activeBuilding";
import { api } from "../../lib/api";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import {
  type TenantOverviewRow,
  tenantsOverviewQueryOptions,
} from "../../lib/tenants";
import { type Unit, unitQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { UnitSupplySection } from "./components/supply/UnitSupplySection";
import { UnitSheet } from "./sheets/UnitSheet";

const routeApi = getRouteApi("/wohnungen/$unitId");

/**
 * Aktueller Mietvertrag der Wohnung (aktiv zum Stichtag heute)
 */
const currentTenantOf = (
  rows: TenantOverviewRow[] | undefined,
  unitId: string,
): TenantOverviewRow | undefined =>
  rows?.find((row) => row.unitId === unitId && row.active);

/**
 * Wohnungs-Ansicht: Kopf mit Status, Kennzahlen und die Stammdaten als Werte-Card
 */
export const UnitEditPage = () => {
  const { unitId } = routeApi.useParams();

  // Aus der Query statt aus den Loader-Daten: nach dem Speichern im Sheet
  // steht der neue Stand sofort in der Ansicht.
  const { data: unit } = useQuery(unitQueryOptions(unitId));

  // Beim Direkteinstieg das Gebäude des Objekts übernehmen
  useAdoptBuilding(unit?.buildingId);
  const navigate = useNavigate();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: tenants } = useQuery({
    ...tenantsOverviewQueryOptions({
      page: 0,
      pageSize: 1000,
      buildingId: unit?.buildingId,
    }),
    enabled: unit !== undefined,
  });

  const updateUnit = useCrudMutation({
    mutationFn: ({ buildingId: _ignored, ...dto }: UnitCreateDto) =>
      api.patch<Unit>(`/units/${unitId}`, dto),
    invalidateKeys: [["units"], ["unit", unitId]],
  });

  const deletion = useDeleteResource<Unit>({
    endpoint: (target) => `/units/${target.id}`,
    invalidateKeys: [["units"]],
    title: t("ui.units.confirmDelete"),
    describe: (target) =>
      t("ui.units.confirmDeleteQuestion", { name: target.name }),
    hint: t("ui.units.confirmDeleteHint"),
    onDeleted: () =>
      navigate({ to: "/wohnungen", search: { buildingId: unit?.buildingId } }),
  });

  if (!unit) {
    return (
      <EntityNotFound
        title={t("ui.units.notFound.title")}
        description={t("ui.units.notFound.description")}
        to="/wohnungen"
      />
    );
  }

  const current = currentTenantOf(tenants?.items, unit.id);

  let statusLabel = t("ui.units.status.vacant");
  if (current) {
    statusLabel =
      current.kind === "owner"
        ? t("ui.units.status.owner")
        : t("ui.units.status.rented");
  }
  const tenantNames = current
    ? current.contractResidents
        .map((resident) => formatName(resident.firstName, resident.lastName))
        .join(t("ui.common.separators.comma"))
    : undefined;

  const dash = t("ui.common.emptyValue");

  return (
    <>
      <div className="max-w-225 pb-6">
        <PageHeader
          tile={<PageHeaderIcon domain="units" />}
          title={unit.name}
          sub={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
              <Badge appearance="dot" variant={current ? "ok" : "neutral"}>
                {statusLabel}
              </Badge>
              {current && tenantNames ? (
                <DomainLink
                  to="/mieter/$tenantId"
                  params={{ tenantId: current.id }}
                >
                  {tenantNames}
                </DomainLink>
              ) : null}
              <DomainLink
                to="/zaehler"
                search={{
                  buildingId: unit.buildingId,
                  unitId: unit.id,
                  type: undefined,
                }}
              >
                {t("ui.units.actions.unitMeters")}
              </DomainLink>
            </span>
          }
          action={<PageDeleteAction onClick={() => deletion.request(unit)} />}
        />

        <SectionCard
          icon={domainVisuals.units.icon}
          title={t("ui.units.sections.baseData.title")}
          action={
            <SectionAction
              kind="edit"
              label={t("ui.common.action.edit")}
              onClick={() => setSheetOpen(true)}
            />
          }
        >
          <ResultRows
            rows={[
              { label: t("ui.units.fields.name"), value: unit.name },
              {
                label: t("ui.units.fields.unitNumber"),
                value: unit.unitNumber ?? dash,
              },
              {
                label: t("ui.units.fields.area"),
                value: t("ui.common.measures.sqm", {
                  value: formatNumber(unit.areaSqm, 2),
                }),
              },
              {
                label: t("ui.units.fields.heatingArea"),
                value:
                  unit.heatingAreaSqm === null
                    ? t("ui.units.fields.heatingAreaSameAsArea")
                    : t("ui.common.measures.sqm", {
                        value: formatNumber(unit.heatingAreaSqm, 2),
                      }),
              },
            ]}
          />
        </SectionCard>

        <UnitSupplySection unitId={unit.id} buildingId={unit.buildingId} />
      </div>

      {sheetOpen ? (
        <UnitSheet
          mode="edit"
          defaultValues={{
            buildingId: unit.buildingId,
            name: unit.name,
            unitNumber: unit.unitNumber ?? "",
            areaSqm: decimalToInput(unit.areaSqm),
            heatingAreaDiffers: unit.heatingAreaSqm !== null,
            heatingAreaSqm: decimalToInput(unit.heatingAreaSqm),
          }}
          onSubmit={async (values) => {
            await updateUnit.mutateAsync(values);

            await router.invalidate();
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      {deletion.dialog}
    </>
  );
};
