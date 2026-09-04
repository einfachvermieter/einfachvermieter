import { formatNumber } from "@einfachvermieter/shared";
import { DomainLink } from "@/components/common/DomainLink";
import { EmptyNote } from "@/components/common/EmptyNote";
import { IconTile } from "@/components/common/IconTile";
import { SectionCard } from "@/components/common/SectionCard";
import { domainVisuals } from "../../../lib/domainVisuals";
import { t } from "../../../lib/i18n";
import type { UnitOverviewRow } from "../../../lib/units";

/**
 * Belegung als zweite Zeile: wer die Wohnung bewohnt, sonst der Leerstand
 */
const occupancyLabel = (unit: UnitOverviewRow): string => {
  const { occupancy } = unit;
  if (occupancy.tenantNames.length > 0) {
    return occupancy.tenantNames.join(t("ui.common.separators.comma"));
  }
  if (occupancy.status === "owner") {
    return t("ui.units.status.owner");
  }
  return t("ui.units.status.vacant");
};

/**
 * Wohnungen des Gebäudes
 */
export const BuildingUnitsCard = ({
  units,
  buildingId,
}: {
  units: UnitOverviewRow[];
  buildingId: string;
}) => (
  <SectionCard
    icon={domainVisuals.units.icon}
    title={t("ui.navigation.units")}
    action={
      <DomainLink to="/wohnungen" search={{ buildingId }}>
        {t("ui.buildings.detail.manageUnits")}
      </DomainLink>
    }
  >
    {units.length === 0 ? (
      <EmptyNote>{t("ui.buildings.detail.unitsEmpty")}</EmptyNote>
    ) : (
      units.map((unit) => (
        <div
          key={unit.id}
          className="flex items-center gap-3.25 border-t border-border px-0.5 py-3.25 first:border-t-0"
        >
          <IconTile icon={domainVisuals.units.icon} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              <DomainLink to="/wohnungen/$unitId" params={{ unitId: unit.id }}>
                {unit.name}
              </DomainLink>
            </p>
            <p className="text-sm text-muted-foreground">
              {occupancyLabel(unit)}
            </p>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {t("ui.common.measures.sqm", {
              value: formatNumber(unit.areaSqm, 2),
            })}
          </span>
        </div>
      ))
    )}
  </SectionCard>
);
