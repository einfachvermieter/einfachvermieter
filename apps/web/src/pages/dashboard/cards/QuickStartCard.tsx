import { Link } from "@tanstack/react-router";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import {
  IconBuilding,
  IconCoins,
  IconDoc,
  IconDoor,
  IconGauge,
  IconPlus,
  IconReceipt,
  IconUsers,
} from "@/lib/icons";
import type { StatsResult } from "@/lib/stats";

/**
 * Häufige Aufgaben als Buttons. Welche erscheinen, hängt am Stand der
 * Einrichtung
 */
export const QuickStartCard = ({
  stats,
  onRecordPayment,
  onAddTenant,
}: {
  stats: StatsResult | undefined;
  onRecordPayment: () => void;
  onAddTenant: () => void;
}) => {
  if (!stats) {
    return null;
  }

  return (
    <SectionCard
      icon={IconPlus}
      title={t("ui.dashboard.quickstart.title")}
      description={t("ui.dashboard.quickstart.description")}
    >
      <div className="flex flex-wrap gap-2.5">
        {stats.buildings === 0 ? (
          <Button asChild={true} variant="outline">
            <Link to="/gebaeude">
              <IconBuilding data-icon="inline-start" />
              {t("ui.dashboard.quickstart.addBuilding")}
            </Link>
          </Button>
        ) : null}
        {stats.buildings > 0 && stats.units === 0 ? (
          <Button asChild={true} variant="outline">
            <Link to="/wohnungen" search={{ buildingId: undefined }}>
              <IconDoor data-icon="inline-start" />
              {t("ui.dashboard.quickstart.addUnit")}
            </Link>
          </Button>
        ) : null}
        {stats.units > 0 && stats.tenants === 0 ? (
          <Button variant="outline" onClick={onAddTenant}>
            <IconUsers data-icon="inline-start" />
            {t("ui.dashboard.quickstart.addTenant")}
          </Button>
        ) : null}
        {stats.tenants > 0 ? (
          <Button asChild={true} variant="outline">
            <Link to="/abrechnungen" search={{ buildingId: undefined }}>
              <IconDoc data-icon="inline-start" />
              {t("ui.dashboard.quickstart.newStatement")}
            </Link>
          </Button>
        ) : null}
        {stats.buildings > 0 ? (
          <Button asChild={true} variant="outline">
            <Link to="/rechnungen" search={{ buildingId: undefined }}>
              <IconReceipt data-icon="inline-start" />
              {t("ui.dashboard.quickstart.recordCost")}
            </Link>
          </Button>
        ) : null}
        {stats.meters > 0 ? (
          <Button asChild={true} variant="outline">
            <Link
              to="/zaehler"
              search={{
                buildingId: undefined,
                type: undefined,
                unitId: undefined,
              }}
            >
              <IconGauge data-icon="inline-start" />
              {t("ui.dashboard.quickstart.recordReading")}
            </Link>
          </Button>
        ) : null}
        {stats.tenants > 0 ? (
          <Button variant="outline" onClick={onRecordPayment}>
            <IconCoins data-icon="inline-start" />
            {t("ui.dashboard.quickstart.recordPayment")}
          </Button>
        ) : null}
      </div>
    </SectionCard>
  );
};
