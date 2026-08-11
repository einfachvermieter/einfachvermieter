import type {
  PaymentPurposeKind,
  PaymentUpdateDto,
} from "@einfachvermieter/shared";
import {
  centsToEurInput,
  emptyPaymentFormValues,
  formatDate,
  paymentFormToDto,
} from "@einfachvermieter/shared";
import { RiMoneyEuroCircleLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { EntityNotFound } from "../../components/common/EntityNotFound";
import { FormPage } from "../../components/common/FormPage";
import { IconTile } from "../../components/common/IconTile";
import { PageHeader } from "../../components/common/PageHeader";
import { TenantContextCard } from "../../components/common/TenantContextCard";
import { FormSkeleton } from "../../components/FormSkeleton";
import { api } from "../../lib/api";
import { gradients } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import {
  type Payment,
  paymentIdentityLabel,
  paymentQueryOptions,
} from "../../lib/payments";
import {
  tenantsOverviewQueryOptions,
  useTenantOptions,
} from "../../lib/tenants";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { PaymentForm } from "./forms/PaymentForm";

const routeApi = getRouteApi("/zahlungen/$paymentId/bearbeiten");

const derivePurposeKind = (payment: Payment): PaymentPurposeKind => {
  if (payment.forMonth) {
    return "month";
  }

  if (payment.forStatementId) {
    return "statement";
  }

  if (payment.forDeposit) {
    return "deposit";
  }

  return "fee";
};

const buildPaymentDefaults = (payment: Payment) => {
  const purposeKind = derivePurposeKind(payment);
  const defaults = emptyPaymentFormValues({
    tenantId: payment.tenantId,
    paymentDate: payment.paymentDate,
    purposeKind,
    forMonth: payment.forMonth ?? "",
  });

  defaults.reference = payment.reference ?? "";
  defaults.forStatementId = payment.forStatementId ?? "";
  defaults.forFeeId = payment.forFeeId ?? "";

  if (purposeKind === "month") {
    defaults.baseRentInput = centsToEurInput(payment.baseRentCents ?? 0);
    defaults.advanceInput = centsToEurInput(payment.advanceCents ?? 0);
  } else {
    defaults.amountInput = centsToEurInput(payment.amountCents ?? 0);
  }

  return { purposeKind, defaults };
};

export const PaymentEditPage = () => {
  const { paymentId } = routeApi.useParams();
  const { tenantId: searchTenantId } = routeApi.useSearch();

  const paymentQuery = useQuery(paymentQueryOptions(paymentId));
  const payment = paymentQuery.data;
  const { data: tenantsResult } = useQuery(
    tenantsOverviewQueryOptions({ page: 0, pageSize: 1000 }),
  );
  const tenants = tenantsResult?.items ?? [];

  const tenantOptions = useTenantOptions(tenants);

  const backTenantId = searchTenantId ?? payment?.tenantId;
  const goBack = useGoBack(
    backTenantId ? "/mieter/$tenantId/konto" : "/mieter",
    backTenantId
      ? { params: { tenantId: backTenantId } }
      : { search: { buildingId: undefined } },
  );

  const updatePayment = useCrudMutation({
    mutationFn: (dto: PaymentUpdateDto) =>
      api.patch<Payment>(`/payments/${paymentId}`, dto),
    invalidateKeys: [["payments"], ["payment", paymentId], ["accounts"]],
    onSuccess: goBack,
  });

  if (paymentQuery.isError) {
    return (
      <EntityNotFound
        title={t("ui.payments.notFound.title")}
        description={t("ui.payments.notFound.description")}
        to="/mieter"
      />
    );
  }

  const editDefaults = payment ? buildPaymentDefaults(payment) : null;
  const contextTenant = tenants.find(({ id }) => id === payment?.tenantId);

  return (
    <FormPage
      head={
        <PageHeader
          tile={
            <IconTile
              icon={RiMoneyEuroCircleLine}
              size={44}
              background={gradients.money}
            />
          }
          title={payment ? paymentIdentityLabel(payment) : ""}
          loading={!payment}
        />
      }
      aside={<TenantContextCard tenant={contextTenant} />}
    >
      {payment && editDefaults ? (
        <PaymentForm
          mode="edit"
          tenantOptions={tenantOptions}
          tenantFieldDisabled={true}
          lockedPurposeKind={editDefaults.purposeKind}
          defaultValues={editDefaults.defaults}
          savedAt={
            payment.updatedAt
              ? formatDate(payment.updatedAt.slice(0, 10))
              : undefined
          }
          onSubmit={async (values) => {
            const dto = paymentFormToDto(values);
            const { tenantId: _omit, ...rest } = dto;
            await updatePayment.mutateAsync(rest);
          }}
          onCancel={goBack}
        />
      ) : (
        <FormSkeleton rows={6} />
      )}
    </FormPage>
  );
};
