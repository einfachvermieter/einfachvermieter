import {
  type RemixiconComponentType,
  RiAddLine,
  RiArrowRightSLine,
  RiBuildingLine,
  RiDashboard2Line,
  RiFileAddLine,
  RiGroupLine,
  RiHome6Line,
  RiMoneyEuroCircleLine,
  RiReceiptLine,
} from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { IconTile } from "@/components/common/IconTile";
import { SectionCard } from "@/components/common/SectionCard";
import { t } from "@/lib/i18n";
import type { StatsResult } from "@/lib/stats";

const TILE_CLASS =
  "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted";

/**
 * Kachel: Icon, Beschriftung, Chevron
 */
const TileContent = ({
  icon,
  children,
}: {
  icon: RemixiconComponentType;
  children: ReactNode;
}) => (
  <>
    <IconTile icon={icon} size={30} />
    <span className="min-w-0 flex-1">{children}</span>
    <RiArrowRightSLine
      aria-hidden={true}
      className="size-4 shrink-0 text-schiefer-400"
    />
  </>
);

/**
 * Häufige Aufgaben. Welche Kacheln erscheinen, hängt am Stand der
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
      icon={RiAddLine}
      title={t("ui.dashboard.quickstart.title")}
      description={t("ui.dashboard.quickstart.description")}
    >
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {stats.buildings === 0 ? (
          <Link to="/gebaeude" className={TILE_CLASS}>
            <TileContent icon={RiBuildingLine}>
              {t("ui.dashboard.quickstart.addBuilding")}
            </TileContent>
          </Link>
        ) : null}
        {stats.buildings > 0 && stats.units === 0 ? (
          <Link
            to="/wohnungen"
            search={{ buildingId: undefined }}
            className={TILE_CLASS}
          >
            <TileContent icon={RiHome6Line}>
              {t("ui.dashboard.quickstart.addUnit")}
            </TileContent>
          </Link>
        ) : null}
        {stats.units > 0 && stats.tenants === 0 ? (
          <button type="button" className={TILE_CLASS} onClick={onAddTenant}>
            <TileContent icon={RiGroupLine}>
              {t("ui.dashboard.quickstart.addTenant")}
            </TileContent>
          </button>
        ) : null}
        {stats.tenants > 0 ? (
          <Link to="/abrechnungen" className={TILE_CLASS}>
            <TileContent icon={RiFileAddLine}>
              {t("ui.dashboard.quickstart.newStatement")}
            </TileContent>
          </Link>
        ) : null}
        {stats.buildings > 0 ? (
          <Link
            to="/rechnungen"
            search={{ buildingId: undefined }}
            className={TILE_CLASS}
          >
            <TileContent icon={RiReceiptLine}>
              {t("ui.dashboard.quickstart.recordCost")}
            </TileContent>
          </Link>
        ) : null}
        {stats.meters > 0 ? (
          <Link
            to="/zaehler"
            search={{
              buildingId: undefined,
              type: undefined,
              unitId: undefined,
            }}
            className={TILE_CLASS}
          >
            <TileContent icon={RiDashboard2Line}>
              {t("ui.dashboard.quickstart.recordReading")}
            </TileContent>
          </Link>
        ) : null}
        {stats.tenants > 0 ? (
          <button
            type="button"
            className={TILE_CLASS}
            onClick={onRecordPayment}
          >
            <TileContent icon={RiMoneyEuroCircleLine}>
              {t("ui.dashboard.quickstart.recordPayment")}
            </TileContent>
          </button>
        ) : null}
      </div>
    </SectionCard>
  );
};
