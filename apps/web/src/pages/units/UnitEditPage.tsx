import {
  formatName,
  formatNumber,
  type UnitCreateDto,
} from "@einfachvermieter/shared";
import { RiDeleteBinLine, RiMoreLine, RiPencilLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { DomainLink } from "../../components/common/DomainLink";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { ResultRows } from "../../components/common/ResultRows";
import { SectionCard } from "../../components/common/SectionCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
import { api } from "../../lib/api";
import { buildingsQueryOptions } from "../../lib/buildings";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import {
  type TenantOverviewRow,
  tenantsOverviewQueryOptions,
} from "../../lib/tenants";
import { type Unit, unitQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
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
  const { data: buildings } = useQuery(buildingsQueryOptions);
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
      t("ui.units.confirmDeleteMessage", { name: target.name }),
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

  const building = buildings?.find((entry) => entry.id === unit.buildingId);
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
          tile={<PageHeaderIcon icon={domainVisuals.units.icon} />}
          title={unit.name}
          titleExtra={
            <Badge variant={current ? "ok" : "neutral"}>{statusLabel}</Badge>
          }
          sub={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {[
                  building?.name,
                  unit.unitNumber
                    ? t("ui.units.unitNumberMeta", { number: unit.unitNumber })
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(t("ui.common.separators.bullet"))}
              </span>
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
                  onSelect={() => deletion.request(unit)}
                >
                  <RiDeleteBinLine />
                  {t("ui.units.actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <SectionCard
          icon={domainVisuals.units.icon}
          title={t("ui.units.sections.baseData.title")}
          action={
            <Button
              type="button"
              variant="addLink"
              size="text"
              onClick={() => setSheetOpen(true)}
            >
              <RiPencilLine />
              {t("ui.common.action.edit")}
            </Button>
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
                value: `${formatNumber(unit.areaSqm, 2)} m²`,
              },
              {
                label: t("ui.units.fields.heatingArea"),
                value:
                  unit.heatingAreaSqm === null
                    ? dash
                    : `${formatNumber(unit.heatingAreaSqm, 2)} m²`,
              },
            ]}
          />
        </SectionCard>
      </div>

      {sheetOpen ? (
        <UnitSheet
          mode="edit"
          defaultValues={{
            buildingId: unit.buildingId,
            name: unit.name,
            unitNumber: unit.unitNumber ?? "",
            areaSqm: String(unit.areaSqm),
            heatingAreaSqm:
              unit.heatingAreaSqm === null ? "" : String(unit.heatingAreaSqm),
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
