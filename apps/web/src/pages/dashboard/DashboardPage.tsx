import { RiDashboardLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Description } from "../../components/common/Description";
import { Heading1 } from "../../components/common/Heading1";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { buildingsQueryOptions } from "../../lib/buildings";
import { t } from "../../lib/i18n";
import { statementsQueryOptions } from "../../lib/statements";
import { tenantsOverviewQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";

export const DashboardPage = () => {
  const { data: buildings } = useQuery(buildingsQueryOptions);
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: tenantsResult } = useQuery(
    tenantsOverviewQueryOptions({ page: 0, pageSize: 1 }),
  );
  const tenantsTotal = tenantsResult?.total;
  const { data: statements } = useQuery(statementsQueryOptions);

  const draftCount =
    statements?.filter((statement) => statement.status === "draft").length ?? 0;

  return (
    <div className="space-y-6">
      <Heading1 icon={<RiDashboardLine />}>{t("ui.dashboard.title")}</Heading1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label={t("ui.dashboard.stats.buildings")}
          value={buildings?.length}
        />
        <StatCard label={t("ui.dashboard.stats.units")} value={units?.length} />
        <StatCard
          label={t("ui.dashboard.stats.tenants")}
          value={tenantsTotal}
        />
        <StatCard
          label={t("ui.dashboard.stats.openStatements")}
          value={draftCount}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("ui.dashboard.quickstart.title")}</CardTitle>
          <Description>{t("ui.dashboard.quickstart.description")}</Description>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <Link
            to="/abrechnungen"
            className="block rounded-md border border-border bg-card px-3 py-2 text-foreground hover:bg-muted"
          >
            {t("ui.dashboard.quickstart.newStatement")}
          </Link>
          <Link
            to="/kostenarten"
            search={{ buildingId: undefined }}
            className="block rounded-md border border-border bg-card px-3 py-2 text-foreground hover:bg-muted"
          >
            {t("ui.dashboard.quickstart.recordCost")}
          </Link>
          <Link
            to="/zaehler"
            search={{
              buildingId: undefined,
              type: undefined,
              unitId: undefined,
            }}
            className="block rounded-md border border-border bg-card px-3 py-2 text-foreground hover:bg-muted"
          >
            {t("ui.dashboard.quickstart.recordReading")}
          </Link>
          <Link
            to="/zahlungen/neu"
            search={{ tenantId: undefined }}
            className="block rounded-md border border-border bg-card px-3 py-2 text-foreground hover:bg-muted"
          >
            {t("ui.dashboard.quickstart.recordPayment")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-muted-foreground">
        {label}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-semibold text-foreground">
        {value ?? "–"}
      </div>
    </CardContent>
  </Card>
);
