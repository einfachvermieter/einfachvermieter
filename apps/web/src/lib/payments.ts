import { formatDate } from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import { formatForMonth } from "./dateInput";
import { t } from "./i18n";

export type {
  PaymentCreateDto,
  PaymentPurpose,
  PaymentPurposeKind,
  PaymentUpdateDto,
} from "@einfachvermieter/shared";

/**
 * Server-Serialisierung einer Zahlungs-Zeile. Genau eines der vier
 * Zweck-Felder ist gesetzt:
 *
 * - `forMonth` (YYYY-MM): laufende Miete mit `baseRentCents` + `advanceCents`
 * - `forStatementId`: NK-Settlement-Tilgung mit `amountCents`
 * - `forDeposit = true`: Kaution mit `amountCents`
 * - `forFeeId`: Gebühren-Tilgung mit `amountCents`
 */
export type Payment = {
  id: string;
  tenantId: string;
  paymentDate: string;
  reference: string | null;
  forMonth: string | null;
  forStatementId: string | null;
  forDeposit: boolean;
  forFeeId: string | null;
  baseRentCents: number | null;
  advanceCents: number | null;
  amountCents: number | null;
  updatedAt?: string;
};

export type PaymentSortColumn = "date" | "amount" | "reference";

export type PaymentsListParams = {
  tenantId?: string;
  buildingId?: string;
  page: number;
  pageSize: number;
  sort?: PaymentSortColumn;
  order?: "asc" | "desc";
  q?: string;
};

export type PaymentsListResult = {
  items: Payment[];
  total: number;
};

export const paymentsQueryOptions = (params: PaymentsListParams) =>
  queryOptions({
    queryKey: ["payments", "page", params],
    queryFn: () => {
      const search = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      });

      if (params.tenantId) {
        search.set("tenantId", params.tenantId);
      }

      if (params.buildingId) {
        search.set("buildingId", params.buildingId);
      }

      if (params.sort) {
        search.set("sort", params.sort);
      }

      if (params.order) {
        search.set("order", params.order);
      }

      if (params.q) {
        search.set("q", params.q);
      }

      return api.get<PaymentsListResult>(`/payments?${search.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

export const paymentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["payment", id],
    queryFn: () => api.get<Payment>(`/payments/${id}`),
  });

/**
 * Effektiver Anzeige-Betrag einer Zahlung, bei Monatszweck die Summe
 * Kalt+NK, bei den anderen Zwecken direkt `amountCents`.
 */
export const paymentDisplayAmountCents = (payment: Payment): number => {
  if (payment.forMonth) {
    return (payment.baseRentCents ?? 0) + (payment.advanceCents ?? 0);
  }
  return payment.amountCents ?? 0;
};

/**
 * Identifizierende Bezeichnung einer Zahlung für Überschrift, Breadcrumb
 * und Tab-Titel: das Zahlungsdatum. Der Mieter-Kontext steht im
 * Breadcrumb-Pfad.
 */
export const paymentIdentityLabel = (
  payment: Pick<Payment, "paymentDate">,
): string =>
  t("ui.payments.identityTitle", { date: formatDate(payment.paymentDate) });

/**
 * Anzeige-Label des Zahlungszwecks (Monat / Abrechnung / Kaution / Gebühr).
 */
export const paymentPurposeLabel = (payment: Payment): string => {
  if (payment.forMonth) {
    return t("ui.payments.purposeSummaryMonth", {
      month: formatForMonth(payment.forMonth),
    });
  }
  if (payment.forStatementId) {
    return t("ui.payments.purposeKinds.statement");
  }
  if (payment.forDeposit) {
    return t("ui.payments.purposeKinds.deposit");
  }
  if (payment.forFeeId) {
    return t("ui.payments.purposeKinds.fee");
  }
  return t("common.unknown");
};
