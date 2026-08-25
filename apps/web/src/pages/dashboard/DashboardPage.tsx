import {
  type RemixiconComponentType,
  RiArrowRightSLine,
  RiBuildingLine,
  RiDashboard2Line,
  RiFileAddLine,
  RiFileList3Line,
  RiGroupLine,
  RiHome6Line,
  RiMoneyEuroCircleLine,
  RiReceiptLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { IconTile } from "../../components/common/IconTile";
import { InitialsAvatar } from "../../components/common/InitialsAvatar";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { buildingsQueryOptions } from "../../lib/buildings";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { statsQueryOptions } from "../../lib/stats";

/**
 * Klasse der KPI-Kacheln
 */
const KPI_CARD_CLASS =
  "block rounded-[18px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-sky-200 hover:bg-sky-50/40 aria-disabled:pointer-events-none aria-disabled:opacity-50";

/**
 * Innenleben einer KPI-Kachel
 */
const KpiCardBody = ({
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
  <>
    <IconTile icon={icon} size={40} background={gradient} />
    <div className="mt-3.5 text-[30px] font-semibold tabular-nums">
      {value ?? t("ui.common.emptyValue")}
    </div>
    <div className="text-[13px] text-muted-foreground">{label}</div>
  </>
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
  const navigate = useNavigate();

  const noBuildings = stats?.buildings === 0;

  const sub = stats
    ? [
        t("ui.dashboard.sub.buildings", { count: stats.buildings }),
        t("ui.units.sub.count", { count: stats.units }),
        t("ui.dashboard.sub.tagline"),
      ].join(t("ui.common.separators.bullet"))
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        tile={<PageHeaderIcon icon={domainVisuals.dashboard.icon} />}
        title={t("ui.dashboard.title")}
        sub={sub}
        subLoading={!stats}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link to="/gebaeude" className={KPI_CARD_CLASS}>
          <KpiCardBody
            icon={RiBuildingLine}
            gradient={gradients.buildings}
            value={stats?.buildings}
            label={t("ui.dashboard.stats.buildings")}
          />
        </Link>
        <Link
          to="/wohnungen"
          search={{ buildingId: undefined }}
          disabled={noBuildings}
          className={KPI_CARD_CLASS}
        >
          <KpiCardBody
            icon={RiHome6Line}
            gradient={gradients.units}
            value={stats?.units}
            label={t("ui.dashboard.stats.units")}
          />
        </Link>
        <Link
          to="/mieter"
          search={{ buildingId: undefined }}
          disabled={noBuildings}
          className={KPI_CARD_CLASS}
        >
          <KpiCardBody
            icon={RiGroupLine}
            gradient={gradients.tenants}
            value={stats?.tenants}
            label={t("ui.dashboard.stats.tenants")}
          />
        </Link>
        <Link
          to="/abrechnungen"
          disabled={noBuildings}
          className={KPI_CARD_CLASS}
        >
          <KpiCardBody
            icon={RiFileList3Line}
            gradient={gradients.statements}
            value={stats?.openStatementsCount}
            label={t("ui.dashboard.stats.openStatements")}
          />
        </Link>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-5.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[17px] font-semibold">
            {t("ui.dashboard.quickstart.title")}
          </h2>
          <p className="mt-0.5 mb-4 text-sm text-slate-400">
            {t("ui.dashboard.quickstart.description")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {stats && stats.buildings === 0 ? (
              <Link to="/gebaeude/neu" className={QUICK_TILE_CLASS}>
                <QuickTileContent
                  icon={RiBuildingLine}
                  gradient={gradients.buildings}
                >
                  {t("ui.dashboard.quickstart.addBuilding")}
                </QuickTileContent>
              </Link>
            ) : null}
            {stats && stats.buildings > 0 && stats.units === 0 ? (
              <Link
                to="/wohnungen/neu"
                search={{ buildingId: undefined }}
                className={QUICK_TILE_CLASS}
              >
                <QuickTileContent icon={RiHome6Line} gradient={gradients.units}>
                  {t("ui.dashboard.quickstart.addUnit")}
                </QuickTileContent>
              </Link>
            ) : null}
            {stats && stats.units > 0 && stats.tenants === 0 ? (
              <Link
                to="/mieter/neu"
                search={{ buildingId: undefined }}
                className={QUICK_TILE_CLASS}
              >
                <QuickTileContent
                  icon={RiGroupLine}
                  gradient={gradients.tenants}
                >
                  {t("ui.dashboard.quickstart.addTenant")}
                </QuickTileContent>
              </Link>
            ) : null}
            {stats && stats.tenants > 0 ? (
              <Link to="/abrechnungen" className={QUICK_TILE_CLASS}>
                <QuickTileContent
                  icon={RiFileAddLine}
                  gradient={gradients.statements}
                >
                  {t("ui.dashboard.quickstart.newStatement")}
                </QuickTileContent>
              </Link>
            ) : null}
            {stats && stats.buildings > 0 ? (
              <Link
                to="/kostenarten"
                search={{ buildingId: undefined }}
                className={QUICK_TILE_CLASS}
              >
                <QuickTileContent
                  icon={RiReceiptLine}
                  gradient={gradients.invoices}
                >
                  {t("ui.dashboard.quickstart.recordCost")}
                </QuickTileContent>
              </Link>
            ) : null}
            {stats && stats.meters > 0 ? (
              <Link
                to="/zaehler"
                search={{
                  buildingId: undefined,
                  type: undefined,
                  unitId: undefined,
                }}
                className={QUICK_TILE_CLASS}
              >
                <QuickTileContent
                  icon={RiDashboard2Line}
                  gradient={gradients.water}
                >
                  {t("ui.dashboard.quickstart.recordReading")}
                </QuickTileContent>
              </Link>
            ) : null}
            {stats && stats.tenants > 0 ? (
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
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[17px] font-semibold">
            {t("ui.dashboard.buildingsCard.title")}
          </h2>
          <p className="mt-0.5 mb-2 text-sm text-slate-400">
            {t("ui.dashboard.buildingsCard.description")}
          </p>
          {(buildings ?? []).map((building) => (
            <button
              key={building.id}
              type="button"
              className="flex w-full cursor-pointer items-center gap-3.25 border-t border-border px-1 py-3.25 text-left first:border-t-0"
              onClick={() => {
                // Nur navigieren, kein setBuildingId(), da sonst Konflikt
                // mit Store, da navigate/buildingId primär ist.
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
