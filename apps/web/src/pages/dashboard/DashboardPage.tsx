import {
  type RemixiconComponentType,
  RiArrowRightSLine,
  RiBillLine,
  RiBuildingLine,
  RiFileAddLine,
  RiFileList3Line,
  RiGroupLine,
  RiHome4Line,
  RiMoneyEuroCircleLine,
  RiSpeedUpLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { IconTile } from "../../components/common/IconTile";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { PageHead } from "../../components/common/PageHead";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { buildingsQueryOptions } from "../../lib/buildings";
import { gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { statsQueryOptions } from "../../lib/stats";

/**
 * KPI-Karte der Übersicht
 */
const KpiCard = ({
  icon,
  gradient,
  value,
  label,
}: {
  icon: RemixiconComponentType;
  gradient: string;
  value: number | undefined;
  label: string;
}) => (
  <div className="rounded-[18px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <IconTile icon={icon} size={40} background={gradient} />
    <div className="mt-3.5 text-[30px] font-semibold tabular-nums">
      {value ?? t("ui.common.emptyValue")}
    </div>
    <div className="text-[13px] text-muted-foreground">{label}</div>
  </div>
);

/**
 * Klassen der Schnellstart-Kachel
 */
const QUICK_TILE_CLASS =
  "flex items-center gap-3 rounded-[14px] bg-muted p-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-slate-200 dark:hover:bg-slate-700";

/**
 * Innenleben einer Schnellstart-Kachel: Icon-Kachel, Label, Chevron
 */
const QuickTileContent = ({
  icon,
  gradient,
  children,
}: {
  icon: RemixiconComponentType;
  gradient: string;
  children: ReactNode;
}) => (
  <>
    <IconTile icon={icon} size={36} background={gradient} />
    <span className="min-w-0 flex-1">{children}</span>
    <RiArrowRightSLine
      aria-hidden={true}
      className="size-4.5 shrink-0 text-slate-400"
    />
  </>
);

export const DashboardPage = () => {
  const { data: stats } = useQuery(statsQueryOptions());
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { setBuildingId } = useActiveBuilding();
  const navigate = useNavigate();

  const sub = stats
    ? [
        t("ui.dashboard.sub.buildings", { count: stats.buildings }),
        t("ui.units.sub.count", { count: stats.units }),
        t("ui.dashboard.sub.tagline"),
      ].join(t("ui.common.separators.bullet"))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow={t("ui.dashboard.eyebrow")}
        title={t("ui.dashboard.title")}
        sub={sub}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={RiBuildingLine}
          gradient={gradients.buildings}
          value={stats?.buildings}
          label={t("ui.dashboard.stats.buildings")}
        />
        <KpiCard
          icon={RiHome4Line}
          gradient={gradients.units}
          value={stats?.units}
          label={t("ui.dashboard.stats.units")}
        />
        <KpiCard
          icon={RiGroupLine}
          gradient={gradients.tenants}
          value={stats?.tenants}
          label={t("ui.dashboard.stats.tenants")}
        />
        <KpiCard
          icon={RiFileList3Line}
          gradient={gradients.statements}
          value={stats?.openStatementsCount}
          label={t("ui.dashboard.stats.openStatements")}
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-5.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[17px] font-semibold">
            {t("ui.dashboard.quickstart.title")}
          </h2>
          <p className="mt-0.5 mb-4 text-[12.5px] text-slate-400">
            {t("ui.dashboard.quickstart.description")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/abrechnungen" className={QUICK_TILE_CLASS}>
              <QuickTileContent
                icon={RiFileAddLine}
                gradient={gradients.statements}
              >
                {t("ui.dashboard.quickstart.newStatement")}
              </QuickTileContent>
            </Link>
            <Link
              to="/kostenarten"
              search={{ buildingId: undefined }}
              className={QUICK_TILE_CLASS}
            >
              <QuickTileContent icon={RiBillLine} gradient={gradients.invoices}>
                {t("ui.dashboard.quickstart.recordCost")}
              </QuickTileContent>
            </Link>
            <Link
              to="/zaehler"
              search={{
                buildingId: undefined,
                type: undefined,
                unitId: undefined,
              }}
              className={QUICK_TILE_CLASS}
            >
              <QuickTileContent icon={RiSpeedUpLine} gradient={gradients.water}>
                {t("ui.dashboard.quickstart.recordReading")}
              </QuickTileContent>
            </Link>
            <Link
              to="/zahlungen/neu"
              search={{ tenantId: undefined }}
              className={QUICK_TILE_CLASS}
            >
              <QuickTileContent
                icon={RiMoneyEuroCircleLine}
                gradient={gradients.money}
              >
                {t("ui.dashboard.quickstart.recordPayment")}
              </QuickTileContent>
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[17px] font-semibold">
            {t("ui.dashboard.buildingsCard.title")}
          </h2>
          <p className="mt-0.5 mb-2 text-[12.5px] text-slate-400">
            {t("ui.dashboard.buildingsCard.description")}
          </p>
          {(buildings ?? []).map((building) => (
            <button
              key={building.id}
              type="button"
              className="flex w-full cursor-pointer items-center gap-3.25 border-t border-border px-1 py-3.25 text-left first:border-t-0"
              onClick={() => {
                setBuildingId(building.id);
                navigate({
                  to: "/wohnungen",
                  search: { buildingId: building.id },
                }).catch(() => undefined);
              }}
            >
              <InitialsAvatar name={building.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold hover:text-sky-700">
                  {building.name}
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {[
                    t("ui.navigation.buildingSwitcher.unitsCount", {
                      count: building.unitsCount,
                    }),
                    t("ui.dashboard.buildingsCard.tenantsCount", {
                      count: building.activeTenantsCount,
                    }),
                  ].join(t("ui.common.separators.bullet"))}
                </span>
              </span>
              <RiArrowRightSLine
                aria-hidden={true}
                className="size-4.5 shrink-0 text-slate-400"
              />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
};
