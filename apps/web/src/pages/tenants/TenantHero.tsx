import {
  formatDate,
  formatEur,
  formatName,
  pickRentForDate,
  todayIso,
} from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { BalanceAmount } from "../../components/common/BalanceAmount";
import { IconTile } from "../../components/common/IconTile";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { PageHeader } from "../../components/common/PageHeader";
import { buildingsQueryOptions } from "../../lib/buildings";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";

/**
 * Hero-Band eines Mieters (Stammdaten- und Konto-Tab): Initialen-Avatar,
 * Vertragspartner, Gebäude/Wohnung/seit. Lädt seine Daten selbst.
 */
export const TenantHero = ({
  tenantId,
  balance,
}: {
  tenantId: string;
  /**
   * Gesetzt = Konto-Variante mit Saldo/Kaution/Status statt Warmmiete-Stats
   */
  balance?: {
    balanceCents: number;
    deposit: { sollCents: number; istCents: number };
  };
}) => {
  const { data: aggregate } = useQuery(tenantQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: buildings } = useQuery(buildingsQueryOptions);

  if (!aggregate) {
    return (
      <PageHeader
        tile={
          <IconTile
            icon={domainVisuals.tenants.icon}
            size={44}
            background={gradients.tenants}
          />
        }
        title=""
        loading={true}
        statsSkeleton={balance ? 3 : 4}
      />
    );
  }

  const { tenant } = aggregate;
  const unit = units?.find((entry) => entry.id === tenant.unitId);
  const building = buildings?.find((entry) => entry.id === unit?.buildingId);

  const today = todayIso();
  const active =
    tenant.startDate <= today &&
    (tenant.endDate === null || tenant.endDate >= today);

  const names = aggregate.residents
    .filter((resident) => resident.isContractParty)
    .map((resident) => formatName(resident.firstName, resident.lastName))
    .join(t("ui.common.separators.comma"));
  const heroName = names || (unit?.name ?? "");

  const currentRent = pickRentForDate(aggregate.rents, today);
  const warmRentCents = currentRent
    ? currentRent.monthlyBaseRentCents + currentRent.monthlyAdvanceCents
    : null;

  const statusStat = {
    label: t("ui.common.columns.status"),
    value: active ? t("ui.tenants.active") : t("ui.tenants.inactive"),
  };

  const stats = balance
    ? [
        {
          label: t("ui.account.balanceLabel"),
          value: <BalanceAmount receivableCents={-balance.balanceCents} />,
        },
        {
          label: t("ui.account.depositLabel"),
          // Offene Kaution positiv als "... offen" ausweisen; ein negativer
          // Betrag suggeriert fälschlich eine Schuld des Vermieters.
          value:
            balance.deposit.sollCents - balance.deposit.istCents > 0
              ? t("ui.account.depositOpen", {
                  amount: formatEur(
                    balance.deposit.sollCents - balance.deposit.istCents,
                  ),
                })
              : formatEur(balance.deposit.istCents),
        },
        statusStat,
      ]
    : [
        {
          label: t("ui.tenant.hero.warmRent"),
          value:
            warmRentCents !== null
              ? formatEur(warmRentCents)
              : t("ui.common.emptyValue"),
        },
        {
          label: t("ui.tenant.fields.deposit"),
          value:
            tenant.depositCents > 0
              ? formatEur(tenant.depositCents)
              : t("ui.common.emptyValue"),
        },
        {
          label: t("ui.tenant.hero.contractStart"),
          value: formatDate(tenant.startDate),
        },
        statusStat,
      ];

  return (
    <PageHeader
      tile={<InitialsAvatar name={heroName} size={44} />}
      title={heroName}
      sub={[
        building?.name,
        unit?.name,
        t("ui.tenants.termSince", { date: formatDate(tenant.startDate) }),
      ]
        .filter(Boolean)
        .join(t("ui.common.separators.bullet"))}
      stats={stats}
    />
  );
};
