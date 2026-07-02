import type { StatementResult } from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import { t } from "./i18n";
import type { TenantAggregate } from "./tenants";
import type { Unit } from "./units";

export type Statement = {
  id: string;
  buildingId: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  documentDate: string | null;
  status: "draft" | "finalized" | "cancelled" | "superseded";
  totalCostsCents: number | null;
  balanceCents: number | null;
  finalizedAt: string | null;
};

export type StatementDetail = Statement & {
  totalAdvancesCents: number | null;
  adjustedMonthlyAdvanceCents: number | null;
  adjustedAdvanceValidFrom: string | null;
  tariffAdjustmentBps: Record<string, number> | null;
  sequenceNumber: number | null;
  revisionNumber: number | null;
  supersedesStatementId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  snapshotData: StatementResult | null;
};

export type StatementStatus = Statement["status"];

export type StatementOverviewRow = {
  id: string;
  buildingId: string;
  tenantId: string;
  unitName: string;
  contractResidents: { firstName: string; lastName: string }[];
  periodStart: string;
  periodEnd: string;
  documentDate: string | null;
  status: StatementStatus;
  totalCostsCents: number | null;
  balanceCents: number | null;
  finalizedAt: string | null;
};

export type StatementSortColumn = "tenant" | "period" | "status" | "balance";

export type StatementsOverviewParams = {
  page: number;
  pageSize: number;
  sort?: StatementSortColumn;
  order?: "asc" | "desc";
  q?: string;
  buildingId?: string;
};

export type StatementsOverviewResult = {
  items: StatementOverviewRow[];
  total: number;
};

export const statementQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["statement", id],
    queryFn: () => api.get<Statement>(`/statements/${id}`),
  });

/**
 * Identifizierende Bezeichnung einer Abrechnung für Überschrift, Breadcrumb
 * und Tab-Titel
 */
export const statementIdentityLabel = ({
  statement,
}: {
  statement: Pick<Statement, "periodStart">;
  aggregate: TenantAggregate;
  units: Unit[];
}): string =>
  t("ui.statements.detail.identityYear", {
    year: statement.periodStart.slice(0, 4),
  });

export const statementsQueryOptions = queryOptions({
  queryKey: ["statements"],
  queryFn: () =>
    api
      .get<StatementsOverviewResult>("/statements", { pageSize: "1000" })
      .then((result) => result.items),
});

export const statementsOverviewQueryOptions = (
  params: StatementsOverviewParams,
) =>
  queryOptions({
    queryKey: ["statements", "page", params],
    queryFn: () => {
      const search = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      });

      if (params.sort) {
        search.set("sort", params.sort);
      }

      if (params.order) {
        search.set("order", params.order);
      }

      if (params.q) {
        search.set("q", params.q);
      }

      if (params.buildingId) {
        search.set("buildingId", params.buildingId);
      }

      return api.get<StatementsOverviewResult>(
        `/statements?${search.toString()}`,
      );
    },
    placeholderData: (prev) => prev,
  });
