import {
  formatDate,
  formatEur,
  formatName,
  pickRentForDate,
  todayIso,
} from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { HeroBand } from "../../components/common/HeroBand";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { buildingsQueryOptions } from "../../lib/buildings";
import { t } from "../../lib/i18n";
import { tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";

/**
 * Hero-Band eines Mieters (Stammdaten- und Konto-Tab): Initialen-Avatar,
 * Vertragspartner, Gebäude/Wohnung/seit, Kennzahlen Warmmiete · Kaution ·
 * Wohnt seit · Status. Lädt seine Daten selbst (Queries sind gecacht).
 */
export const TenantHero = ({
  tenantId,
  eyebrow,
}: {
  tenantId: string;
  eyebrow: string;
}) => {
  const { data: aggregate } = useQuery(tenantQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: buildings } = useQuery(buildingsQueryOptions);

  if (!aggregate) {
    return null;
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

  return (
    <HeroBand
      tile={<InitialsAvatar name={heroName} size={64} />}
      eyebrow={eyebrow}
      title={heroName}
      meta={[
        building?.name,
        unit?.name,
        t("ui.tenants.termSince", { date: formatDate(tenant.startDate) }),
      ]
        .filter(Boolean)
        .join(t("ui.common.separators.bullet"))}
      stats={[
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
          label: t("ui.tenant.hero.livesSince"),
          value: formatDate(tenant.startDate),
        },
        {
          label: t("ui.common.columns.status"),
          value: active ? t("ui.tenants.active") : t("ui.tenants.inactive"),
        },
      ]}
    />
  );
};
