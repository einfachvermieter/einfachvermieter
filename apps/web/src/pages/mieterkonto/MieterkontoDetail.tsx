import {
  formatDate,
  formatEur,
  type MonthGridRow,
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
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyNote } from "../../components/common/EmptyNote";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { SectionCard } from "../../components/common/SectionCard";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Button } from "../../components/ui/Button";
import {
  type FeeRow,
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
import { tenantQueryOptions } from "../../lib/tenants";
import { useDeleteResource } from "../../lib/useDeleteResource";
import {
  PaymentSheet,
  type PaymentSheetRequest,
} from "../payments/PaymentSheet";
import { TenantDetailLayout } from "../tenants/TenantDetailLayout";
import { AccountPaymentsTable } from "./components/AccountPaymentsTable";
import { DepositSummary } from "./components/DepositSummary";
import { FeeSheet } from "./components/FeeSheet";
import { type FeeDeletionTarget, FeesTable } from "./components/FeesTable";
import { MonthGridTable } from "./components/MonthGridTable";
import { SettlementsTable } from "./components/SettlementsTable";

const routeApi = getRouteApi("/mieter/$tenantId/konto");

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Konto-Seite mit fünf Cards und den Erfassungs-Sheets
export const MieterkontoDetail = () => {
  const { tenantId } = routeApi.useParams();
  const today = todayIso();

  // Der Mieter-Header (Hero + Kennzahlen) lädt seine Daten selbst;
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
    ,
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
    // Eine gelöschte Zahlung verändert Saldo und Monatsraster, die beide
    // unter "accounts" hängen.
    invalidateKeys: [["payments"], ["accounts"]],
    title: t("ui.payments.confirmDelete"),
    describe: (payment) =>
      t("ui.payments.confirmDeleteMessage", {
        date: formatDate(payment.paymentDate),
        amount: formatEur(paymentDisplayAmountCents(payment)),
      }),
  });

  const feeDeletion = useDeleteResource<FeeDeletionTarget>({
    endpoint: (row) => `/accounts/fees/${row.id}`,
    invalidateKeys: [["accounts"]],
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

  // Mieter-Aggregat für die Soll-Beschreibung der Miete-Card.
  const { data: aggregate } = useQuery(tenantQueryOptions(tenantId));
  const currentRent = aggregate
    ? pickRentForDate(aggregate.rents, today)
    : undefined;

  // Offenes Zahlungs- bzw. Gebühren-Sheet; null = geschlossen.
  const [paymentRequest, setPaymentRequest] =
    useState<PaymentSheetRequest | null>(null);
  const [feeSheet, setFeeSheet] = useState<{ fee: FeeRow | null } | null>(null);

  const openPaymentForm = (preset: MonthGridRow | null) =>
    setPaymentRequest({
      mode: "create",
      tenantId,
      purposeKind: "month",
      ...(preset
        ? {
            forMonth: preset.forMonth,
            baseRentCents: preset.baseRent.sollCents,
            advanceCents: preset.advance.sollCents,
          }
        : {}),
    });

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
  // leere Tabellen auf, bis die Queries eintrudeln.
  const isPending =
    accountQueries.some((query) => query.isPending) || paymentsQuery.isPending;

  const mieteDescription = currentRent
    ? t("ui.account.detail.mieteDescription", {
        base: formatEur(currentRent.monthlyBaseRentCents),
        advance: formatEur(currentRent.monthlyAdvanceCents),
      })
    : t("ui.account.detail.mieteDescriptionPlain");

  const addLink = (label: string, onClick: () => void) => (
    <Button variant="addLink" size="text" type="button" onClick={onClick}>
      <RiAddLine />
      {label}
    </Button>
  );

  return (
    <>
      <TenantDetailLayout tenantId={tenantId} active="konto" className="pb-6">
        {isPending ? (
          <FormSkeleton rows={8} />
        ) : (
          <div>
            <SectionCard
              icon={RiMoneyEuroCircleLine}
              title={t("ui.account.monthsHeading")}
              description={mieteDescription}
              action={addLink(t("ui.payments.add"), () =>
                openPaymentForm(null),
              )}
            >
              <div className="-mx-2">
                <MonthGridTable
                  monthRows={monthRows ?? []}
                  payments={payments}
                  deletion={paymentDeletion}
                  onRecordPayment={openPaymentForm}
                  onEditPayment={(payment) =>
                    setPaymentRequest({ mode: "edit", payment })
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={RiSafe2Line}
              title={t("ui.account.depositHeading")}
              description={t("ui.account.detail.depositDescription")}
              action={addLink(t("ui.account.deposit.record"), () =>
                setPaymentRequest({
                  mode: "create",
                  tenantId,
                  purposeKind: "deposit",
                }),
              )}
            >
              <DepositSummary row={depositRow ?? null} />
            </SectionCard>

            <SectionCard
              icon={RiBankCard2Line}
              title={t("ui.account.otherPaymentsHeading")}
              description={t("ui.account.detail.paymentsDescription")}
              action={addLink(t("ui.payments.add"), () =>
                setPaymentRequest({ mode: "create", tenantId }),
              )}
            >
              {otherPayments.length > 0 ? (
                <div className="-mx-2">
                  <AccountPaymentsTable
                    rows={otherPayments}
                    deletion={paymentDeletion}
                    onEditPayment={(payment) =>
                      setPaymentRequest({ mode: "edit", payment })
                    }
                  />
                </div>
              ) : (
                <EmptyNote>{t("ui.account.detail.emptyPayments")}</EmptyNote>
              )}
            </SectionCard>

            <SectionCard
              icon={RiFileList3Line}
              title={t("ui.account.settlementsHeading")}
              description={t("ui.account.detail.settlementsDescription")}
            >
              {settlementRows && settlementRows.length > 0 ? (
                <div className="-mx-2">
                  <SettlementsTable rows={settlementRows} />
                </div>
              ) : (
                <EmptyNote>{t("ui.account.detail.emptySettlements")}</EmptyNote>
              )}
            </SectionCard>

            <SectionCard
              icon={RiReceiptLine}
              title={t("ui.account.feesHeading")}
              description={t("ui.account.detail.feesDescription")}
              action={addLink(t("ui.account.fee.add"), () =>
                setFeeSheet({ fee: null }),
              )}
            >
              {feeRows && feeRows.length > 0 ? (
                <div className="-mx-2">
                  <FeesTable
                    rows={feeRows}
                    deletion={feeDeletion}
                    onEditFee={(row) => setFeeSheet({ fee: row })}
                    onRecordPayment={(row) =>
                      setPaymentRequest({
                        mode: "create",
                        tenantId,
                        purposeKind: "fee",
                        forFeeId: row.feeId,
                      })
                    }
                  />
                </div>
              ) : (
                <EmptyNote>{t("ui.account.detail.emptyFees")}</EmptyNote>
              )}
            </SectionCard>
          </div>
        )}
      </TenantDetailLayout>

      {paymentRequest ? (
        <PaymentSheet
          request={paymentRequest}
          onClose={() => setPaymentRequest(null)}
        />
      ) : null}
      {feeSheet ? (
        <FeeSheet
          tenantId={tenantId}
          fee={feeSheet.fee}
          onClose={() => setFeeSheet(null)}
        />
      ) : null}

      {feeDeletion.dialog}
      {paymentDeletion.dialog}
    </>
  );
};
