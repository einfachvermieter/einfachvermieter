import {
  centsToEurInput,
  emptyPaymentFormValues,
  paymentFormToDto,
  todayIso,
} from "@einfachvermieter/shared";
import { RiMoneyEuroCircleLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FormPage } from "../../components/common/FormPage";
import { FormSkeleton } from "../../components/FormSkeleton";
import { Button } from "../../components/ui/Button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/Empty";
import { api } from "../../lib/api";
import { t } from "../../lib/i18n";
import type { Payment } from "../../lib/payments";
import {
  tenantsOverviewQueryOptions,
  useTenantOptions,
} from "../../lib/tenants";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { useGoBack } from "../../lib/useGoBack";
import { PaymentForm } from "./forms/PaymentForm";

const routeApi = getRouteApi("/zahlungen/neu");

export const PaymentCreatePage = () => {
  const {
    tenantId: searchTenantId,
    forMonth: searchForMonth,
    baseRentCents: searchBaseRentCents,
    advanceCents: searchAdvanceCents,
    purposeKind: searchPurposeKind,
    forFeeId: searchForFeeId,
  } = routeApi.useSearch();
  const tenantsQuery = useQuery(
    tenantsOverviewQueryOptions({ page: 0, pageSize: 1000 }),
  );
  const tenants = tenantsQuery.data?.items ?? [];

  const tenantOptions = useTenantOptions(tenants);

  const preselectedTenant = searchTenantId
    ? tenants.find(({ id }) => id === searchTenantId)
    : tenants[0];
  const initialTenantId = preselectedTenant?.id ?? "";
  const today = todayIso();

  // Wird aus dem Monatsraster heraus ein konkreter Monat gebucht, kommt er
  // (mit Soll als Startwert) vorbefüllt; Betrag/Datum bleiben editierbar.
  const defaultValues = useMemo(() => {
    const values = emptyPaymentFormValues({
      tenantId: initialTenantId,
      paymentDate: today,
      purposeKind: searchPurposeKind ?? "month",
      forMonth: searchForMonth ?? today.slice(0, 7),
    });

    if (searchBaseRentCents !== undefined) {
      values.baseRentInput = centsToEurInput(searchBaseRentCents);
    }

    if (searchAdvanceCents !== undefined) {
      values.advanceInput = centsToEurInput(searchAdvanceCents);
    }

    if (searchPurposeKind === "fee" && searchForFeeId) {
      values.forFeeId = searchForFeeId;
    }

    return values;
  }, [
    initialTenantId,
    today,
    searchForMonth,
    searchBaseRentCents,
    searchAdvanceCents,
    searchPurposeKind,
    searchForFeeId,
  ]);

  // Nach dem Erfassen zurück in den passenden Sub-Reiter des Mieterkontos
  const returnTabByPurpose: Partial<Record<string, "kaution" | "gebuehren">> = {
    deposit: "kaution",
    fee: "gebuehren",
  };
  const returnTab = searchPurposeKind
    ? returnTabByPurpose[searchPurposeKind]
    : undefined;

  const goBack = useGoBack(
    preselectedTenant?.id ? "/mieter/$tenantId/konto" : "/mieter",
    preselectedTenant?.id
      ? {
          params: { tenantId: preselectedTenant.id },
          search: { tab: returnTab },
        }
      : { search: { buildingId: undefined } },
  );

  const createPayment = useCrudMutation({
    mutationFn: (dto: ReturnType<typeof paymentFormToDto>) =>
      api.post<Payment>("/payments", dto),
    invalidateKeys: [["payments"], ["accounts"], ["stats"]],
    onSuccess: goBack,
  });

  if (tenantsQuery.isPending) {
    return <FormSkeleton rows={6} />;
  }

  // Ohne Mietvertrag gibt es nichts zu buchen, statt einer leeren Seite
  // ein Hinweis mit Absprung zur Mieter-Anlage.
  if (tenants.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiMoneyEuroCircleLine />
          </EmptyMedia>
          <EmptyTitle>{t("ui.payments.noTenantsTitle")}</EmptyTitle>
          <EmptyDescription>
            {t("ui.payments.noTenantsDescription")}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild={true}>
            <Link to="/mieter/neu">{t("ui.payments.noTenantsAction")}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <FormPage title={t("ui.payments.createTitle")}>
      <PaymentForm
        key={initialTenantId}
        mode="create"
        tenantOptions={tenantOptions}
        allowedPurposeKinds={["month", "statement"]}
        lockedPurposeKind={searchPurposeKind}
        defaultValues={defaultValues}
        onSubmit={async (values) => {
          await createPayment.mutateAsync(paymentFormToDto(values));
        }}
        onCancel={goBack}
      />
    </FormPage>
  );
};
