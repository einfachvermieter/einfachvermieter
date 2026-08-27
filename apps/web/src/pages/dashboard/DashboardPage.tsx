import {
  type RemixiconComponentType,
  RiArrowRightSLine,
  RiBuildingLine,
  RiDashboard2Line,
  RiFileAddLine,
  RiGroupLine,
  RiHome6Line,
  RiMoneyEuroCircleLine,
  RiReceiptLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { IconTile } from "../../components/common/IconTile";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { buildingsQueryOptions } from "../../lib/buildings";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { statsQueryOptions } from "../../lib/stats";
import { PaymentSheet } from "../payments/PaymentSheet";
import { TenantCreateSheet } from "../tenants/TenantCreateSheet";

/**
 * Klasse der KPI-Cards
 */
const KPI_CARD_CLASS =
  "block rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50";

/**
 * Innenleben einer KPI-Card: Label oben, großer Wert darunter
 */
const KpiCardBody = ({
  value,
  label,
}: {
  value: number | undefined;
  label: string;
}) => (
  <>
    <div className="text-xs font-medium text-muted-foreground">{label}</div>
    <div className="mt-1.5 font-heading text-3xl font-semibold tracking-heading tabular-nums">
      {value ?? t("ui.common.emptyValue")}
    </div>
  </>
);

/**
 * Klassen der Schnellstart-Kachel
 */
const QUICK_TILE_CLASS =
  "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted";

/**
 * Innenleben einer Schnellstart-Kachel: Icon-Kachel, Label, Chevron
 */
const QuickTileContent = ({
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
 * Card Header: Titel und Beschreibung
 */
const CardHead = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="mb-3">
    <h2 className="text-base font-semibold">{title}</h2>
    <p className="text-xs text-muted-foreground">{description}</p>
  </div>
);

const BuildingIcon = domainVisuals.buildings.icon;

export const DashboardPage = () => {
  const { data: stats } = useQuery(statsQueryOptions());
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const navigate = useNavigate();
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [tenantSheetOpen, setTenantSheetOpen] = useState(false);

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

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Link to="/gebaeude" className={KPI_CARD_CLASS}>
          <KpiCardBody
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
            value={stats?.openStatementsCount}
            label={t("ui.dashboard.stats.openStatements")}
          />
        </Link>
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[1.45fr_1fr]">
        <section className="rounded-xl border border-border bg-card px-5 py-4">
          <CardHead
            title={t("ui.dashboard.quickstart.title")}
            description={t("ui.dashboard.quickstart.description")}
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {stats && stats.buildings === 0 ? (
              <Link to="/gebaeude/neu" className={QUICK_TILE_CLASS}>
                <QuickTileContent icon={RiBuildingLine}>
                  {t("ui.dashboard.quickstart.addBuilding")}
                </QuickTileContent>
              </Link>
            ) : null}
            {stats && stats.buildings > 0 && stats.units === 0 ? (
              <Link
                to="/wohnungen"
                search={{ buildingId: undefined }}
                className={QUICK_TILE_CLASS}
              >
                <QuickTileContent icon={RiHome6Line}>
                  {t("ui.dashboard.quickstart.addUnit")}
                </QuickTileContent>
              </Link>
            ) : null}
            {stats && stats.units > 0 && stats.tenants === 0 ? (
              <button
                type="button"
                className={QUICK_TILE_CLASS}
                onClick={() => setTenantSheetOpen(true)}
              >
                <QuickTileContent icon={RiGroupLine}>
                  {t("ui.dashboard.quickstart.addTenant")}
                </QuickTileContent>
              </button>
            ) : null}
            {stats && stats.tenants > 0 ? (
              <Link to="/abrechnungen" className={QUICK_TILE_CLASS}>
                <QuickTileContent icon={RiFileAddLine}>
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
                <QuickTileContent icon={RiReceiptLine}>
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
                <QuickTileContent icon={RiDashboard2Line}>
                  {t("ui.dashboard.quickstart.recordReading")}
                </QuickTileContent>
              </Link>
            ) : null}
            {stats && stats.tenants > 0 ? (
              <button
                type="button"
                className={QUICK_TILE_CLASS}
                onClick={() => setPaymentSheetOpen(true)}
              >
                <QuickTileContent icon={RiMoneyEuroCircleLine}>
                  {t("ui.dashboard.quickstart.recordPayment")}
                </QuickTileContent>
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card px-5 py-4">
          <CardHead
            title={t("ui.dashboard.buildingsCard.title")}
            description={t("ui.dashboard.buildingsCard.description")}
          />
          {(buildings ?? []).map((building) => (
            <button
              key={building.id}
              type="button"
              className="flex w-full cursor-pointer items-center gap-3 border-t border-schiefer-100 px-0.5 py-3 text-left first:border-t-0"
              onClick={() => {
                // Nur navigieren, kein setBuildingId(), da sonst Konflikt
                // mit Store, da navigate/buildingId primär ist.
                navigate({
                  to: "/wohnungen",
                  search: { buildingId: building.id },
                }).catch(() => undefined);
              }}
            >
              <BuildingIcon
                aria-hidden={true}
                className="size-5 shrink-0 text-schiefer-500"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {building.name}
                </span>
                <span className="block text-xs text-muted-foreground">
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
                className="size-4 shrink-0 text-schiefer-400"
              />
            </button>
          ))}
        </section>
      </div>

      {paymentSheetOpen ? (
        <PaymentSheet
          request={{ mode: "create" }}
          onClose={() => setPaymentSheetOpen(false)}
        />
      ) : null}
      {tenantSheetOpen ? (
        <TenantCreateSheet onClose={() => setTenantSheetOpen(false)} />
      ) : null}
    </div>
  );
};
