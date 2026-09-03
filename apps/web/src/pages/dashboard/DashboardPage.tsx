import { formatDate, formatDateLong, todayIso } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { PageHeaderIcon } from "../../components/common/PageHeaderIcon";
import { FormSkeleton } from "../../components/FormSkeleton";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { dashboardQueryOptions, statsQueryOptions } from "../../lib/stats";
import { PaymentSheet } from "../payments/PaymentSheet";
import { TenantCreateSheet } from "../tenants/TenantCreateSheet";
import { DashboardBuildings } from "./cards/DashboardBuildings";
import { DashboardKpis } from "./cards/DashboardKpis";
import { DashboardTasks } from "./cards/DashboardTasks";
import { QuickStartCard } from "./cards/QuickStartCard";
import { RentIntakeChart } from "./cards/RentIntakeChart";

export const DashboardPage = () => {
  const { data: stats } = useQuery(statsQueryOptions());
  const { data: dashboard } = useQuery(dashboardQueryOptions);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [tenantSheetOpen, setTenantSheetOpen] = useState(false);

  const today = todayIso();
  const openStatements = dashboard
    ? dashboard.statementsTotal - dashboard.statementsDone
    : 0;

  // Ohne Mietverhältnisse gibt es keine Mieteingänge zu zeigen; dann steht
  // der Schnellstart oben, weil Einrichten die eigentliche Aufgabe ist.
  const hasRent =
    dashboard?.months.some((month) => month.targetCents > 0) ?? false;
  const showQuickStartFirst = !hasRent;

  const quickStart = (
    <QuickStartCard
      stats={stats}
      onRecordPayment={() => setPaymentSheetOpen(true)}
      onAddTenant={() => setTenantSheetOpen(true)}
    />
  );

  /**
   * Motto of the Day. Ohne abzurechnende Mietverhältnisse gibt es
   * dazu nichts zu sagen: dann nur Datum.
   */
  const headline = (): string | undefined => {
    if (stats?.buildings === 0) {
      return t("ui.dashboard.headline.noBuildings");
    }
    if (!dashboard || dashboard.statementsTotal === 0) {
      return;
    }
    if (openStatements === 0) {
      return t("ui.dashboard.headline.allDone", {
        year: dashboard.statementYear,
      });
    }

    return t("ui.dashboard.headline.statementsDue", {
      count: openStatements,
      year: dashboard.statementYear,
      deadline: formatDate(dashboard.statementDeadline),
    });
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        tile={<PageHeaderIcon icon={domainVisuals.dashboard.icon} />}
        title={t("ui.dashboard.greeting")}
        sub={[formatDateLong(today), headline()]
          .filter(Boolean)
          .join(t("ui.common.separators.bullet"))}
        subLoading={!dashboard}
        breadcrumb={false}
      />

      {dashboard && dashboard.buildings.length === 0 ? quickStart : null}

      {dashboard && dashboard.buildings.length > 0 ? (
        <>
          <DashboardKpis data={dashboard} />

          {/* Zwei Spalten, in denen die Cards für sich fließen: so rutscht
              jede nach oben, statt auf die höhere Nachbarin zu warten. */}
          <div className="grid items-start gap-x-3.5 lg:grid-cols-2 *:min-w-0">
            <div>
              {showQuickStartFirst ? quickStart : null}
              <DashboardTasks
                data={dashboard}
                month={Number(today.slice(5, 7))}
                showWhenEmpty={hasRent}
              />
              {hasRent ? <RentIntakeChart data={dashboard} /> : null}
            </div>
            <div>
              <DashboardBuildings data={dashboard} />
              {showQuickStartFirst ? null : quickStart}
            </div>
          </div>
        </>
      ) : null}

      {dashboard ? null : <FormSkeleton rows={4} kpis={3} />}

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
