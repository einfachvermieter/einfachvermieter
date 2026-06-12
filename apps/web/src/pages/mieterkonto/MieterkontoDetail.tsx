import { formatDate, formatEur, todayIso } from "@einfachvermieter/shared";
import { RiAddLine } from "@remixicon/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/Tabs";
import {
  tenantBalanceQueryOptions,
  tenantDepositQueryOptions,
  tenantFeesQueryOptions,
  tenantMonthGridQueryOptions,
  tenantSettlementsQueryOptions,
} from "../../lib/accounts";
import { t } from "../../lib/i18n";
import {
  type Payment,
  paymentDisplayAmountCents,
  paymentsQueryOptions,
} from "../../lib/payments";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { TenantDetailHeader } from "../tenants/TenantDetailHeader";
import { TenantHero } from "../tenants/TenantHero";
import { AccountPaymentsTable } from "./components/AccountPaymentsTable";
import { DepositSummary } from "./components/DepositSummary";
import { type FeeDeletionTarget, FeesTable } from "./components/FeesTable";
import { MonthGridTable } from "./components/MonthGridTable";
import { SettlementsTable } from "./components/SettlementsTable";

const routeApi = getRouteApi("/mieter/$tenantId/konto");

type KontoTab =
  | "miete"
  | "zahlungen"
  | "abrechnungen"
  | "kaution"
  | "gebuehren";

export const MieterkontoDetail = () => {
  const { tenantId } = routeApi.useParams();
  const { tab } = routeApi.useSearch();
  const navigate = useNavigate();
  const today = todayIso();

  // Der Mieter-Aggregat (für Kopf/H1) lädt der TenantDetailHeader selbst;
  // hier nur die kontospezifischen Töpfe.
  const accountQueries = useQueries({
    queries: [
      tenantBalanceQueryOptions(tenantId),
      tenantMonthGridQueryOptions(tenantId, {
        from: "2000-01-01",
        to: today,
      }),
      tenantSettlementsQueryOptions(tenantId),
      tenantDepositQueryOptions(tenantId),
      tenantFeesQueryOptions(tenantId),
    ],
  });
  const [
    { data: balance },
    { data: monthRows },
    { data: settlementRows },
    { data: depositRow },
    { data: feeRows },
  ] = accountQueries;

  const paymentsQuery = useQuery(
    paymentsQueryOptions({ tenantId, page: 0, pageSize: 1000 }),
  );
  const payments = paymentsQuery.data?.items ?? [];

  const paymentDeletion = useDeleteResource<Payment>({
    endpoint: (payment) => `/payments/${payment.id}`,
    invalidateKey: ["payments"],
    title: t("ui.payments.confirmDelete"),
    describe: (payment) =>
      t("ui.payments.confirmDeleteMessage", {
        date: formatDate(payment.paymentDate),
        amount: formatEur(paymentDisplayAmountCents(payment)),
      }),
  });

  const feeDeletion = useDeleteResource<FeeDeletionTarget>({
    endpoint: (row) => `/accounts/fees/${row.id}`,
    invalidateKey: ["accounts"],
    title: t("ui.account.fee.confirmDelete"),
    describe: (row) =>
      t("ui.account.fee.confirmDeleteMessage", {
        date: formatDate(row.date),
        amount: formatEur(row.amountCents),
      }),
  });

  // Nicht-Monats-Buchungen (Abrechnung/Kaution/Gebühr). Die Monatsmieten
  // leben im Monatsraster und tauchen hier nicht doppelt auf.
  const otherPayments = useMemo(
    () => payments.filter((payment) => !payment.forMonth),
    [payments],
  );

  if (accountQueries.some((query) => query.isError) || paymentsQuery.isError) {
    return (
      <EntityNotFound
        title={t("ui.tenants.notFound.title")}
        description={t("ui.tenants.notFound.description")}
        to="/mieter"
      />
    );
  }

  // Erst rendern, wenn alle Konto-Daten da sind. Sonst blitzen
  // 0,00-€-Salden und leere Tabellen auf, bis die Queries eintrudeln.
  const isPending =
    accountQueries.some((query) => query.isPending) || paymentsQuery.isPending;
  if (isPending) {
    return <FormSkeleton rows={8} />;
  }

  return (
    <div className="space-y-6">
      <TenantHero tenantId={tenantId} eyebrow={t("ui.tenants.tabs.account")} />
      <TenantDetailHeader tenantId={tenantId} active="konto" hideTitle={true} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 py-6">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              {t("ui.account.balanceLabel")}
            </span>
            <span className="text-2xl font-semibold tabular-nums">
              {formatEur(balance?.balanceCents ?? 0)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              {t("ui.account.depositLabel")}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {formatEur(balance?.depositBalanceCents ?? 0)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={tab ?? "miete"}
        onValueChange={(value) => {
          navigate({
            to: "/mieter/$tenantId/konto",
            params: { tenantId },
            search: { tab: value as KontoTab },
          }).catch(() => undefined);
        }}
      >
        <TabsList variant="line">
          <TabsTrigger value="miete">{t("ui.account.tabs.rent")}</TabsTrigger>
          <TabsTrigger value="zahlungen">
            {t("ui.account.tabs.payments")}
          </TabsTrigger>
          <TabsTrigger value="abrechnungen">
            {t("ui.account.tabs.settlements")}
          </TabsTrigger>
          <TabsTrigger value="kaution">
            {t("ui.account.tabs.deposit")}
          </TabsTrigger>
          <TabsTrigger value="gebuehren">
            {t("ui.account.tabs.fees")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="miete">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              {t("ui.account.monthsHeading")}
            </h2>
            <Card>
              <CardContent className="p-0">
                <MonthGridTable
                  monthRows={monthRows ?? []}
                  payments={payments}
                  tenantId={tenantId}
                  deletion={paymentDeletion}
                />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="zahlungen">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("ui.account.otherPaymentsHeading")}
              </h2>
              <Button asChild={true} variant="outline" size="sm">
                <Link to="/zahlungen/neu" search={{ tenantId }}>
                  <RiAddLine />
                  {t("ui.payments.add")}
                </Link>
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <AccountPaymentsTable
                  rows={otherPayments}
                  tenantId={tenantId}
                  deletion={paymentDeletion}
                />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="abrechnungen">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              {t("ui.account.settlementsHeading")}
            </h2>
            <Card>
              <CardContent className="p-0">
                <SettlementsTable rows={settlementRows ?? []} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="kaution">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("ui.account.depositHeading")}
              </h2>
              <Button asChild={true} variant="outline" size="sm">
                <Link
                  to="/zahlungen/neu"
                  search={{ tenantId, purposeKind: "deposit" }}
                >
                  <RiAddLine />
                  {t("ui.account.deposit.record")}
                </Link>
              </Button>
            </div>
            <Card>
              <CardContent className="py-6">
                <DepositSummary row={depositRow ?? null} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="gebuehren">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("ui.account.feesHeading")}
              </h2>
              <Button asChild={true} variant="outline" size="sm">
                <Link
                  to="/mieter/$tenantId/gebuehren/neu"
                  params={{ tenantId }}
                >
                  <RiAddLine />
                  {t("ui.account.fee.add")}
                </Link>
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <FeesTable
                  rows={feeRows ?? []}
                  tenantId={tenantId}
                  deletion={feeDeletion}
                />
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      {feeDeletion.dialog}
      {paymentDeletion.dialog}
    </div>
  );
};
