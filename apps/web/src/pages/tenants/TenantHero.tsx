import { formatEur, todayIso } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { Badge } from "../../components/ui/Badge";
import {
  tenantBalanceQueryOptions,
  tenantDepositQueryOptions,
} from "../../lib/accounts";
import { useAdoptBuilding } from "../../lib/activeBuilding";
import { t } from "../../lib/i18n";
import {
  contractPartyNames,
  contractPartyNamesShort,
  tenantQueryOptions,
} from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";

/**
 * Seitenkopf eines Mieters (Stammdaten- und Konto-Tab): Titel mit dem
 * Bereich davor, darunter die Wohnung als Link und der Status als Punkte.
 * Neben "Aktiv" stehen nur Abweichungen (Kaution offen, Rückstand,
 * Guthaben). Lädt seine Daten selbst.
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
  const { data: balance } = useQuery(tenantBalanceQueryOptions(tenantId));
  const { data: deposit } = useQuery(tenantDepositQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);

  // Beim Direkteinstieg das Gebäude des Objekts übernehmen
  useAdoptBuilding(
    units?.find((entry) => entry.id === aggregate?.tenant.unitId)?.buildingId,
  );

  if (!aggregate) {
    return (
      <PageHeader
        tile={<PageHeaderIcon domain="tenants" />}
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

  const names = contractPartyNames(aggregate.residents);
  const heroName = names || (unit?.name ?? "");

  // Neben "Aktiv" erscheinen nur Zustände, die Aufmerksamkeit brauchen,
  // nie "alles in Ordnung"
  const receivableCents = balance ? -balance.balanceCents : 0;
  const depositOpen =
    deposit !== undefined &&
    deposit.pot.sollCents > 0 &&
    deposit.pot.istCents < deposit.pot.sollCents;

  return (
    <PageHeader
      tile={<PageHeaderIcon domain="tenants" />}
      title={heroName}
      titleShort={
        names ? contractPartyNamesShort(aggregate.residents) : undefined
      }
      sub={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
          {unit ? (
            <Link
              to="/wohnungen/$unitId"
              params={{ unitId: unit.id }}
              className="text-azur-700 underline-offset-3 hover:underline"
            >
              {unit.name}
            </Link>
          ) : null}
          <Badge appearance="dot" variant={active ? "ok" : "neutral"}>
            {active ? t("ui.tenants.active") : t("ui.tenants.inactive")}
          </Badge>
          {depositOpen ? (
            <Badge appearance="dot" variant="warn">
              {t("ui.tenant.hero.depositOpen")}
            </Badge>
          ) : null}
          {receivableCents > 0 ? (
            <Badge appearance="dot" variant="bad">
              {t("ui.tenant.hero.arrears", {
                amount: formatEur(receivableCents),
              })}
            </Badge>
          ) : null}
          {receivableCents < 0 ? (
            <Badge appearance="dot" variant="info">
              {t("ui.tenant.hero.credit", {
                amount: formatEur(-receivableCents),
              })}
            </Badge>
          ) : null}
        </span>
      }
      action={action}
    />
  );
};
