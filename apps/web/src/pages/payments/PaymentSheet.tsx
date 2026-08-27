import type {
  PaymentPurposeKind,
  PaymentUpdateDto,
} from "@einfachvermieter/shared";
import {
  centsToEurInput,
  emptyPaymentFormValues,
  paymentFormToDto,
  todayIso,
} from "@einfachvermieter/shared";
import { RiMoneyEuroCircleLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../../lib/api";
import { t } from "../../lib/i18n";
import { type Payment, paymentIdentityLabel } from "../../lib/payments";
import {
  tenantsOverviewQueryOptions,
  useTenantOptions,
} from "../../lib/tenants";
import { useCrudMutation } from "../../lib/useCrudMutation";
import { PaymentForm } from "./forms/PaymentForm";

/**
 * Was das Zahlungs-Sheet erfassen bzw. bearbeiten soll. Beim Erfassen
 * legt ein gesetzter Zweck (z. B. Kaution, Gebühr) den Zweck fest
 */
export type PaymentSheetRequest =
  | {
      mode: "create";
      tenantId?: string;
      purposeKind?: PaymentPurposeKind;
      forMonth?: string;
      baseRentCents?: number;
      advanceCents?: number;
      forFeeId?: string;
    }
  | { mode: "edit"; payment: Payment };

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

const buildEditDefaults = (payment: Payment) => {
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
    // Beim Bearbeiten die exakten Bestandsbeträge zeigen: getrennte
    // Eingabe statt Gesamtsumme (die Summe müsste sonst wieder aufs
    // Vertrags-Soll aufgeteilt werden und könnte Teilzahlungen verfälschen).
    defaults.inputMode = "split";
    defaults.baseRentInput = centsToEurInput(payment.baseRentCents ?? 0);
    defaults.advanceInput = centsToEurInput(payment.advanceCents ?? 0);
  } else {
    defaults.amountInput = centsToEurInput(payment.amountCents ?? 0);
  }

  return { purposeKind, defaults };
};

/**
 * Zahlung erfassen/bearbeiten im FormSheet
 */
export const PaymentSheet = ({
  request,
  onClose,
}: {
  request: PaymentSheetRequest;
  onClose: () => void;
}) => {
  const tenantsQuery = useQuery(
    tenantsOverviewQueryOptions({ page: 0, pageSize: 1000 }),
  );
  const tenants = tenantsQuery.data?.items ?? [];
  const tenantOptions = useTenantOptions(tenants);

  const fixedTenantId =
    request.mode === "edit" ? request.payment.tenantId : request.tenantId;

  const { defaults, lockedPurposeKind, allowedPurposeKinds } = useMemo(() => {
    if (request.mode === "edit") {
      const edit = buildEditDefaults(request.payment);
      return {
        defaults: edit.defaults,
        lockedPurposeKind: edit.purposeKind,
        allowedPurposeKinds: undefined,
      };
    }

    const today = todayIso();
    const values = emptyPaymentFormValues({
      tenantId: fixedTenantId ?? tenants[0]?.id ?? "",
      paymentDate: today,
      purposeKind: request.purposeKind ?? "month",
      forMonth: request.forMonth ?? today.slice(0, 7),
    });

    if (request.baseRentCents !== undefined) {
      values.baseRentInput = centsToEurInput(request.baseRentCents);
    }

    if (request.advanceCents !== undefined) {
      values.advanceInput = centsToEurInput(request.advanceCents);
    }

    if (request.purposeKind === "fee" && request.forFeeId) {
      values.forFeeId = request.forFeeId;
    }

    return {
      defaults: values,
      lockedPurposeKind: request.purposeKind,
      // Kaution und Gebühr kommen nur über den festen Zweck herein
      allowedPurposeKinds: request.purposeKind
        ? [request.purposeKind]
        : (["month", "statement"] as PaymentPurposeKind[]),
    };
  }, [request, fixedTenantId, tenants]);

  const savePayment = useCrudMutation({
    mutationFn: (dto: ReturnType<typeof paymentFormToDto>) => {
      if (request.mode === "edit") {
        const { tenantId: _omit, ...rest } = dto;
        return api.patch<Payment>(
          `/payments/${request.payment.id}`,
          rest satisfies PaymentUpdateDto,
        );
      }
      return api.post<Payment>("/payments", dto);
    },
    invalidateKeys:
      request.mode === "edit"
        ? [["payments"], ["payment", request.payment.id], ["accounts"]]
        : [["payments"], ["accounts"], ["stats"]],
    onSuccess: onClose,
  });

  // Ohne feste Mieter-Vorgabe erst rendern, wenn die Auswahl geladen ist
  if (!fixedTenantId && request.mode === "create" && tenantsQuery.isPending) {
    return null;
  }

  return (
    <PaymentForm
      mode={request.mode}
      icon={RiMoneyEuroCircleLine}
      title={
        request.mode === "edit"
          ? paymentIdentityLabel(request.payment)
          : t("ui.payments.createTitle")
      }
      tenantOptions={tenantOptions}
      tenantFieldDisabled={Boolean(fixedTenantId)}
      lockedPurposeKind={lockedPurposeKind}
      allowedPurposeKinds={allowedPurposeKinds}
      defaultValues={defaults}
      onSubmit={async (values) => {
        await savePayment.mutateAsync(paymentFormToDto(values));
      }}
      onClose={onClose}
    />
  );
};
