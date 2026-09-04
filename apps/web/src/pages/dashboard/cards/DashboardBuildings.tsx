import { formatEur } from "@einfachvermieter/shared";
import { DomainLink } from "@/components/common/DomainLink";
import { IconTile } from "@/components/common/IconTile";
import { SectionCard } from "@/components/common/SectionCard";
import { domainVisuals } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";
import type { DashboardResult } from "@/lib/stats";
import { cn } from "@/lib/utils";

/**
 * Belegung als Kästchenreihe: gefüllt = vermietet, gestrichelt = frei
 */
const OccupancyBoxes = ({
  units,
  rented,
}: {
  units: number;
  rented: number;
}) => (
  <span className="mt-1.5 flex gap-1">
    {Array.from({ length: units }, (_, index) => (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: Kästchen
        key={index}
        className={cn(
          "block size-3 rounded",
          index < rented
            ? "bg-limette-500"
            : "border-[1.5px] border-dashed border-schiefer-300",
        )}
      />
    ))}
  </span>
);

/**
 * Gebäude mit Belegung, Sollmiete und dem, was dort gerade offen ist
 */
export const DashboardBuildings = ({ data }: { data: DashboardResult }) => {
  const totalUnits = data.buildings.reduce(
    (sum, building) => sum + building.unitsCount,
    0,
  );
  const totalRent = data.buildings.reduce(
    (sum, building) => sum + building.monthlyRentCents,
    0,
  );

  return (
    <SectionCard
      icon={domainVisuals.buildings.icon}
      title={t("ui.dashboard.buildingsCard.title")}
      description={t("ui.dashboard.buildingsCard.description")}
      action={
        <DomainLink to="/gebaeude">
          {t("ui.dashboard.buildingsCard.manage")}
        </DomainLink>
      }
    >
      {data.buildings.map((building) => (
        <div
          key={building.id}
          className="flex items-center gap-3.25 border-t border-border py-3 first:border-t-0"
        >
          <IconTile icon={domainVisuals.buildings.icon} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              <DomainLink
                to="/gebaeude/$buildingId"
                params={{ buildingId: building.id }}
              >
                {building.name}
              </DomainLink>
            </span>
            <span className="block text-sm text-muted-foreground">
              {building.unitsCount === 0 ? (
                t("ui.dashboard.buildingsCard.noUnits")
              ) : (
                <>
                  <DomainLink
                    to="/wohnungen"
                    search={{ buildingId: building.id }}
                    icon={domainVisuals.units.icon}
                  >
                    {t("ui.dashboard.buildingsCard.unitsLink", {
                      count: building.unitsCount,
                    })}
                  </DomainLink>
                  {t("ui.common.separators.bullet")}
                  <DomainLink
                    to="/mieter"
                    search={{ buildingId: building.id }}
                    icon={domainVisuals.tenants.icon}
                  >
                    {t("ui.dashboard.buildingsCard.rentedLink", {
                      count: building.rentedCount,
                    })}
                  </DomainLink>
                </>
              )}
            </span>
            {building.unitsCount > 0 ? (
              <OccupancyBoxes
                units={building.unitsCount}
                rented={building.rentedCount}
              />
            ) : null}
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-semibold tabular-nums">
              {building.unitsCount === 0
                ? t("ui.common.emptyValue")
                : formatEur(building.monthlyRentCents)}
            </span>
            <span className="block text-xs text-muted-foreground">
              <BuildingHint building={building} year={data.statementYear} />
            </span>
          </span>
        </div>
      ))}

      <p className="mt-3 text-xs text-muted-foreground">
        {t("ui.dashboard.buildingsCard.total", {
          units: totalUnits,
          amount: formatEur(totalRent),
        })}
      </p>
    </SectionCard>
  );
};

/**
 * Wichtigster Hinweis je Gebäude: erst Geld, dann Frist, dann Einrichtung.
 * Jeder Hinweis führt dorthin, wo sich die Sache erledigen lässt.
 */
const BuildingHint = ({
  building,
  year,
}: {
  building: DashboardResult["buildings"][number];
  year: number;
}) => {
  if (building.unitsCount === 0) {
    return (
      <DomainLink
        to="/wohnungen"
        search={{ buildingId: building.id }}
        icon={domainVisuals.units.icon}
      >
        {t("ui.dashboard.buildingsCard.setUp")}
      </DomainLink>
    );
  }
  if (building.overdueCents > 0) {
    return (
      <DomainLink to="/mieter" search={{ buildingId: building.id }}>
        {t("ui.dashboard.buildingsCard.overdue", {
          amount: formatEur(building.overdueCents),
        })}
      </DomainLink>
    );
  }
  if (building.missingStatements > 0) {
    return (
      <DomainLink
        to="/abrechnungen"
        search={{ buildingId: building.id }}
        icon={domainVisuals.statements.icon}
      >
        {t("ui.dashboard.buildingsCard.missingStatements", { year })}
      </DomainLink>
    );
  }

  return null;
};
