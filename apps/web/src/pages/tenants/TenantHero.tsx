import { formatName, todayIso } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { Badge } from "../../components/ui/Badge";
import { useAdoptBuilding } from "../../lib/activeBuilding";
import { domainVisuals } from "../../lib/domainVisuals";
import { formatPeriod } from "../../lib/format";
import { t } from "../../lib/i18n";
import { currentResidentCount, tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";

/**
 * Hero-Band eines Mieters (Stammdaten- und Konto-Tab): Titel mit
 * Status-Badge, Unterzeile mit Wohnungs-Querverweis, Laufzeit und
 * Bewohner-Zahl. Lädt seine Daten selbst.
 */
export const TenantHero = ({
  tenantId,
  action,
}: {
  tenantId: string;

  /**
   * Aktionen rechts im Kopf, z.B. das ...-Menü mit "Mieter löschen"
   */
  action?: ReactNode;
}) => {
  const { data: aggregate } = useQuery(tenantQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);

  // Beim Direkteinstieg das Gebäude des Objekts übernehmen
  useAdoptBuilding(
    units?.find((entry) => entry.id === aggregate?.tenant.unitId)?.buildingId,
  );

  if (!aggregate) {
    return (
      <PageHeader
        tile={<PageHeaderIcon icon={domainVisuals.tenants.icon} />}
        title=""
        loading={true}
      />
    );
  }

  const { tenant } = aggregate;
  const unit = units?.find((entry) => entry.id === tenant.unitId);

  const today = todayIso();
  const active =
    tenant.startDate <= today &&
    (tenant.endDate === null || tenant.endDate >= today);

  const names = aggregate.residents
    .filter((resident) => resident.isContractParty)
    .map((resident) => formatName(resident.firstName, resident.lastName))
    .join(t("ui.common.separators.comma"));
  const heroName = names || (unit?.name ?? "");

  const residentCount = currentResidentCount(
    aggregate.residents,
    tenant,
    today,
  );

  const subItems: ReactNode[] = [];
  if (unit) {
    subItems.push(
      <Link
        to="/wohnungen/$unitId"
        params={{ unitId: unit.id }}
        className="underline-offset-3 transition-colors hover:text-azur-700 hover:underline"
      >
        {unit.name}
      </Link>,
    );
  }
  subItems.push(<span>{formatPeriod(tenant.startDate, tenant.endDate)}</span>);
  subItems.push(
    <span>{t("ui.tenant.hero.residentsCount", { count: residentCount })}</span>,
  );

  return (
    <PageHeader
      tile={<PageHeaderIcon icon={domainVisuals.tenants.icon} />}
      title={heroName}
      titleExtra={
        <Badge variant={active ? "ok" : "neutral"}>
          {active ? t("ui.tenants.active") : t("ui.tenants.inactive")}
        </Badge>
      }
      sub={
        <span>
          {subItems.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: statische Liste
            <Fragment key={index}>
              {index > 0 ? t("ui.common.separators.bullet") : null}
              {item}
            </Fragment>
          ))}
        </span>
      }
      action={action}
    />
  );
};
