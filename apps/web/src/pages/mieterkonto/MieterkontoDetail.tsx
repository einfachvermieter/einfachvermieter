import {
  centsToEurInput,
  emptyPaymentFormValues,
  formatDate,
  formatEur,
  formatName,
  type MonthGridRow,
  paymentFormToDto,
  pickRentForDate,
  todayIso,
} from "@einfachvermieter/shared";
import {
  RiAddLine,
  RiBankCard2Line,
  RiFileList3Line,
  RiMoneyEuroCircleLine,
  RiReceiptLine,
  RiSafe2Line,
} from "@remixicon/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ActionLink } from "../../components/common/ActionLink";
import { EmptyNote } from "../../components/common/EmptyNote";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { InfoCard } from "../../components/common/InfoCard";
import { SectionCard } from "../../components/common/SectionCard";
import { FormSkeleton } from "../../components/FormSkeleton";
import { TextWithLink } from "../../components/TextWithLink";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  TabCount,
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
import { api } from "../../lib/api";
import { domainVisuals, gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import {
  type Payment,
  paymentDisplayAmountCents,
  paymentsQueryOptions,
} from "../../lib/payments";
import { tenantQueryOptions } from "../../lib/tenants";
import { unitsQueryOptions } from "../../lib/units";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useDeleteResource } from "../../lib/useDeleteResource";
import { PaymentForm } from "../payments/forms/PaymentForm";
import { TenantDetailHeader } from "../tenants/TenantDetailHeader";
import { TenantHero } from "../tenants/TenantHero";
import { AccountPaymentsTable } from "./components/AccountPaymentsTable";
import { DepositSummary } from "./components/DepositSummary";
import { FeeInlineForm } from "./components/FeeInlineForm";
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

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Konto-Seite mit fünf Registern und eingebettetem Zahlungsformular
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Konto-Seite mit fünf Registern, Infospalte und Inline-Formularen
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

  // Mieter-Aggregat nur für die Namensanzeige im
  // eingebetteten Zahlungsformular.
  const { data: aggregate } = useQuery(tenantQueryOptions(tenantId));
  const { data: units } = useQuery(unitsQueryOptions);
  const tenantName = aggregate
    ? aggregate.residents
        .filter((resident) => resident.isContractParty)
        .map((resident) => formatName(resident.firstName, resident.lastName))
        .join(t("ui.common.separators.comma"))
    : "";

  // Infospalten-Kennzahlen aus dem Mieter-Aggregat.
  const unit = units?.find((entry) => entry.id === aggregate?.tenant.unitId);
  const currentRent = aggregate
    ? pickRentForDate(aggregate.rents, today)
    : undefined;
  const sepaGranted =
    aggregate?.bankAccounts.some((account) => account.mandateSignedAt) ?? false;
  const latestSettlement = settlementRows?.[0];

  // Inline-Zahlungserfassung im Miete-Tab: null = geschlossen, sonst die
  // Vorbelegung (Monat + Vertrags-Soll) für das Subform.
  const [paymentPreset, setPaymentPreset] = useState<{
    forMonth?: string;
    baseRentCents?: number;
    advanceCents?: number;
  } | null>(null);

  // Inline-Gebührenerfassung im Gebühren-Tab.
  const [feeFormOpen, setFeeFormOpen] = useState(false);

  const createPayment = useCrudMutation({
    mutationFn: (dto: ReturnType<typeof paymentFormToDto>) =>
      api.post<Payment>("/payments", dto),
    invalidateKeys: [["payments"], ["accounts"], ["stats"]],
    onSuccess: () => setPaymentPreset(null),
  });

  const openPaymentForm = (preset: MonthGridRow | null) =>
    setPaymentPreset(
      preset
        ? {
            forMonth: preset.forMonth,
            baseRentCents: preset.baseRent.sollCents,
            advanceCents: preset.advance.sollCents,
          }
        : {},
    );

  const buildPaymentDefaults = () => {
    const values = emptyPaymentFormValues({
      tenantId,
      paymentDate: today,
      purposeKind: "month",
      forMonth: paymentPreset?.forMonth ?? today.slice(0, 7),
    });

    if (paymentPreset?.baseRentCents !== undefined) {
      values.baseRentInput = centsToEurInput(paymentPreset.baseRentCents);
    }

    if (paymentPreset?.advanceCents !== undefined) {
      values.advanceInput = centsToEurInput(paymentPreset.advanceCents);
    }

    return values;
  };

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

  const mieteDescription = currentRent
    ? t("ui.account.detail.mieteDescription", {
        base: formatEur(currentRent.monthlyBaseRentCents),
        advance: formatEur(currentRent.monthlyAdvanceCents),
      })
    : t("ui.account.detail.mieteDescriptionPlain");

  const recordPaymentFromAction = () => {
    openPaymentForm(null);

    navigate({
      to: "/mieter/$tenantId/konto",
      params: { tenantId },
      search: { tab: "miete" },
    }).catch(() => undefined);
  };

  const addLink = (label: string, onClick: () => void) => (
    <Button variant="addLink" size="text" type="button" onClick={onClick}>
      <RiAddLine />
      {label}
    </Button>
  );

  return (
    <div className="space-y-6 pb-6">
      <TenantHero
        tenantId={tenantId}
        balance={
          balance
            ? {
                balanceCents: balance.balanceCents,
                deposit: depositRow?.pot ?? { sollCents: 0, istCents: 0 },
              }
            : undefined
        }
      />
      <TenantDetailHeader tenantId={tenantId} active="konto" />

      {isPending ? (
        <FormSkeleton rows={8} />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] *:min-w-0">
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
            <TabsList variant="pills">
              <TabsTrigger value="miete">
                {t("ui.account.tabs.rent")}
              </TabsTrigger>
              <TabsTrigger value="zahlungen">
                {t("ui.account.tabs.payments")}
                {otherPayments.length > 0 ? (
                  <TabCount>{otherPayments.length}</TabCount>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="abrechnungen">
                {t("ui.account.tabs.settlements")}
                {settlementRows && settlementRows.length > 0 ? (
                  <TabCount>{settlementRows.length}</TabCount>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="kaution">
                {t("ui.account.tabs.deposit")}
              </TabsTrigger>
              <TabsTrigger value="gebuehren">
                {t("ui.account.tabs.fees")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="miete">
              <SectionCard
                icon={RiMoneyEuroCircleLine}
                iconBackground={gradients.money}
                title={t("ui.account.monthsHeading")}
                description={mieteDescription}
                action={addLink(t("ui.payments.add"), () =>
                  openPaymentForm(null),
                )}
              >
                {paymentPreset ? (
                  <div className="mb-4">
                    <PaymentForm
                      key={paymentPreset.forMonth ?? "new"}
                      variant="inline"
                      mode="create"
                      tenantOptions={[{ value: tenantId, label: tenantName }]}
                      tenantFieldDisabled={true}
                      allowedPurposeKinds={["month"]}
                      lockedPurposeKind="month"
                      defaultValues={buildPaymentDefaults()}
                      onSubmit={async (values) => {
                        await createPayment.mutateAsync(
                          paymentFormToDto(values),
                        );
                      }}
                      onCancel={() => setPaymentPreset(null)}
                    />
                  </div>
                ) : null}
                <div className="-mx-2">
                  <MonthGridTable
                    monthRows={monthRows ?? []}
                    payments={payments}
                    tenantId={tenantId}
                    deletion={paymentDeletion}
                    onRecordPayment={openPaymentForm}
                  />
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="zahlungen">
              <SectionCard
                icon={RiBankCard2Line}
                iconBackground={gradients.bank}
                title={t("ui.account.otherPaymentsHeading")}
                description={t("ui.account.detail.paymentsDescription")}
                action={addLink(t("ui.payments.add"), () =>
                  navigate({
                    to: "/zahlungen/neu",
                    search: { tenantId },
                  }).catch(() => undefined),
                )}
              >
                {otherPayments.length > 0 ? (
                  <div className="-mx-2">
                    <AccountPaymentsTable
                      rows={otherPayments}
                      tenantId={tenantId}
                      deletion={paymentDeletion}
                    />
                  </div>
                ) : (
                  <EmptyNote>
                    <TextWithLink
                      template={t("ui.account.detail.emptyPayments")}
                      link={
                        <Link
                          to="/mieter/$tenantId/konto"
                          params={{ tenantId }}
                          search={{ tab: "miete" }}
                          className="font-semibold text-foreground underline"
                        >
                          {t("ui.account.tabs.rent")}
                        </Link>
                      }
                    />
                  </EmptyNote>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="abrechnungen">
              <SectionCard
                icon={RiFileList3Line}
                iconBackground={gradients.statements}
                title={t("ui.account.settlementsHeading")}
                description={t("ui.account.detail.settlementsDescription")}
              >
                {settlementRows && settlementRows.length > 0 ? (
                  <div className="-mx-2">
                    <SettlementsTable rows={settlementRows} />
                  </div>
                ) : (
                  <EmptyNote>
                    {t("ui.account.detail.emptySettlements")}
                  </EmptyNote>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="kaution">
              <SectionCard
                icon={RiSafe2Line}
                iconBackground={gradients.tenants}
                title={t("ui.account.depositHeading")}
                description={t("ui.account.detail.depositDescription")}
                action={addLink(t("ui.account.deposit.record"), () =>
                  navigate({
                    to: "/zahlungen/neu",
                    search: { tenantId, purposeKind: "deposit" },
                  }).catch(() => undefined),
                )}
              >
                <DepositSummary row={depositRow ?? null} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="gebuehren">
              <SectionCard
                icon={RiReceiptLine}
                iconBackground={gradients.invoices}
                title={t("ui.account.feesHeading")}
                description={t("ui.account.detail.feesDescription")}
                action={addLink(t("ui.account.fee.add"), () =>
                  setFeeFormOpen((open) => !open),
                )}
              >
                {feeFormOpen ? (
                  <div className="mb-4">
                    <FeeInlineForm
                      tenantId={tenantId}
                      onDone={() => setFeeFormOpen(false)}
                    />
                  </div>
                ) : null}
                {feeRows && feeRows.length > 0 ? (
                  <div className="-mx-2">
                    <FeesTable
                      rows={feeRows}
                      tenantId={tenantId}
                      deletion={feeDeletion}
                    />
                  </div>
                ) : (
                  <EmptyNote>{t("ui.account.detail.emptyFees")}</EmptyNote>
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col gap-4 xl:sticky xl:top-24">
            <InfoCard title={t("ui.common.infoCards.links")}>
              <ActionLink
                icon={domainVisuals.tenants.icon}
                iconBackground={domainVisuals.tenants.accent}
                onClick={() =>
                  navigate({
                    to: "/mieter/$tenantId",
                    params: { tenantId },
                  }).catch(() => undefined)
                }
              >
                {t("ui.tenants.tabs.master")}
              </ActionLink>
              {unit ? (
                <ActionLink
                  icon={domainVisuals.units.icon}
                  iconBackground={domainVisuals.units.accent}
                  onClick={() =>
                    navigate({
                      to: "/wohnungen/$unitId",
                      params: { unitId: unit.id },
                    }).catch(() => undefined)
                  }
                >
                  {unit.name}
                </ActionLink>
              ) : null}
            </InfoCard>

            <InfoCard
              title={t("ui.common.infoCards.details")}
              rows={[
                {
                  label: t("ui.account.detail.sepaLabel"),
                  value: (
                    <Badge variant={sepaGranted ? "ok" : "slate"}>
                      {sepaGranted
                        ? t("ui.account.detail.sepaGranted")
                        : t("ui.account.detail.sepaMissing")}
                    </Badge>
                  ),
                },
              ]}
            />

            <InfoCard title={t("ui.common.infoCards.actions")}>
              <ActionLink
                icon={RiMoneyEuroCircleLine}
                iconBackground={domainVisuals.units.accent}
                onClick={recordPaymentFromAction}
              >
                {t("ui.payments.add")}
              </ActionLink>
              {latestSettlement ? (
                <ActionLink
                  icon={RiFileList3Line}
                  iconBackground={domainVisuals.statements.accent}
                  onClick={() =>
                    navigate({
                      to: "/abrechnungen/$statementId",
                      params: { statementId: latestSettlement.statementId },
                    }).catch(() => undefined)
                  }
                >
                  {t("ui.account.detail.openStatement")}
                </ActionLink>
              ) : null}
            </InfoCard>
          </div>
        </div>
      )}

      {feeDeletion.dialog}
      {paymentDeletion.dialog}
    </div>
  );
};
