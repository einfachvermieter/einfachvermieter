import { DomainLink } from "@/components/common/DomainLink";
import { EmptyNote } from "@/components/common/EmptyNote";
import { IconTile } from "@/components/common/IconTile";
import { SectionCard } from "@/components/common/SectionCard";
import { domainVisuals } from "../../../lib/domainVisuals";
import { t } from "../../../lib/i18n";

/**
 * Zähler, die den Verbrauch für diese Kostenart liefern. Die Zuordnung
 * selbst wird am Zähler gepflegt, deshalb nur Querverweise.
 */
export const CostTypeMetersCard = ({
  meters,
  buildingId,
}: {
  meters: { id: string; label: string; sub: string }[];
  buildingId: string;
}) => (
  <SectionCard
    icon={domainVisuals.meters.icon}
    title={t("ui.costs.detail.metersSection")}
    description={t("ui.costs.detail.metersDescription")}
    action={
      <DomainLink
        to="/zaehler"
        search={{ buildingId, unitId: undefined, type: undefined }}
      >
        {t("ui.costs.detail.manageMeters")}
      </DomainLink>
    }
  >
    {meters.length === 0 ? (
      <EmptyNote>{t("ui.costs.detail.metersEmpty")}</EmptyNote>
    ) : (
      meters.map((meter) => (
        <div
          key={meter.id}
          className="flex items-center gap-3.25 border-t border-border px-0.5 py-3.25 first:border-t-0"
        >
          <IconTile icon={domainVisuals.meters.icon} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              <DomainLink to="/zaehler/$meterId" params={{ meterId: meter.id }}>
                {meter.label}
              </DomainLink>
            </p>
            <p className="text-sm text-muted-foreground">{meter.sub}</p>
          </div>
        </div>
      ))
    )}
  </SectionCard>
);
