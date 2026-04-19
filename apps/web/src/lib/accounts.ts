import type {
  DepositRow,
  FeeRow,
  MonthGridRow,
  SettlementRow,
  TenantBalanceResult,
} from "@einfachvermieter/shared";
import { formatDate } from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import { t } from "./i18n";

export type {
  AccountFeeCreateDto,
  AccountFeeUpdateDto,
  DepositRow,
  FeeRow,
  MonthGridRow,
  PotState,
  PotStatus,
  SettlementRow,
  TenantBalanceResult,
} from "@einfachvermieter/shared";

/**
 * Identifizierende Bezeichnung einer Gebühr für Überschrift, Breadcrumb und
 * Tab-Titel: das Gebührendatum. Der Mieter-Kontext steht im Breadcrumb-Pfad.
 */
export const feeIdentityLabel = (fee: Pick<FeeRow, "date">): string =>
  t("ui.account.fee.identityTitle", { date: formatDate(fee.date) });

export type TenantBalanceSummary = {
  tenantId: string;
  balanceCents: number;
  depositCents: number;
};

export const allTenantBalancesQueryOptions = (params: {
  asOf?: string;
  buildingId?: string;
}) =>
  queryOptions({
    queryKey: ["accounts", "balances", params],
    queryFn: () => {
      const search = new URLSearchParams();

      if (params.asOf) {
        search.set("asOf", params.asOf);
      }

      if (params.buildingId) {
        search.set("buildingId", params.buildingId);
      }

      const qs = search.toString();

      return api.get<TenantBalanceSummary[]>(
        `/accounts/balances${qs ? `?${qs}` : ""}`,
      );
    },
  });

export const tenantBalanceQueryOptions = (tenantId: string, asOf?: string) =>
  queryOptions({
    queryKey: ["accounts", "balance", tenantId, asOf ?? "today"],
    queryFn: () => {
      const qs = asOf ? `?asOf=${asOf}` : "";
      return api.get<TenantBalanceResult>(`/accounts/${tenantId}/balance${qs}`);
    },
  });

export const tenantMonthGridQueryOptions = (
  tenantId: string,
  range: { from: string; to: string },
) =>
  queryOptions({
    queryKey: ["accounts", "months", tenantId, range],
    queryFn: () => {
      const search = new URLSearchParams({ from: range.from, to: range.to });

      return api.get<MonthGridRow[]>(
        `/accounts/${tenantId}/months?${search.toString()}`,
      );
    },
  });

export const tenantSettlementsQueryOptions = (tenantId: string) =>
  queryOptions({
    queryKey: ["accounts", "settlements", tenantId],
    queryFn: () =>
      api.get<SettlementRow[]>(`/accounts/${tenantId}/settlements`),
  });

export const tenantDepositQueryOptions = (tenantId: string) =>
  queryOptions({
    queryKey: ["accounts", "deposit", tenantId],
    queryFn: () => api.get<DepositRow>(`/accounts/${tenantId}/deposit`),
  });

export const tenantFeesQueryOptions = (tenantId: string) =>
  queryOptions({
    queryKey: ["accounts", "fees", tenantId],
    queryFn: () => api.get<FeeRow[]>(`/accounts/${tenantId}/fees`),
  });
