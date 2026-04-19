import { formatName } from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "./api";
import { t } from "./i18n";
import type { Unit } from "./units";

export type TenantKind = "private" | "commercial" | "owner";

export const tenantKindValues: readonly TenantKind[] = [
  "private",
  "commercial",
  "owner",
];

/**
 * Im Formular auswählbare Vertragsarten; `commercial` fehlt, solange es keine
 * Gewerbe-Sonderlogik gibt.
 */
export const selectableTenantKindValues: readonly TenantKind[] =
  tenantKindValues.filter((kind) => kind !== "commercial");

export const tenantKindLabel = (kind: TenantKind): string =>
  t(`tenants.kinds.${kind}`);

export type Tenant = {
  id: string;
  unitId: string;
  kind: TenantKind;
  startDate: string;
  endDate: string | null;
  /**
   * Vereinbarte Kaution in Cent. 0 = keine Kaution vereinbart.
   */
  depositCents: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantResidentLink = {
  tenantResidentId: string;
  residentId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  isContractParty: boolean;
};

/**
 * Namen der Vertragspartner eines Mietvertrags als kommaseparierte Liste,
 * die identifizierende Bezeichnung des Vertrags für Überschriften,
 * Breadcrumbs und Tab-Titel.
 */
export const contractPartyNames = (residents: TenantResidentLink[]): string =>
  residents
    .filter((resident) => resident.isContractParty)
    .map((resident) => formatName(resident.firstName, resident.lastName))
    .join(", ");

/**
 * Identifizierende Bezeichnung eines Mietvertrags für Überschrift,
 * Breadcrumb und Tab-Titel: Vertragspartner und Wohnung. Ohne das Wort
 * "Mietvertrag". Der Typ steht bereits im Breadcrumb-Pfad ("Mieter").
 */
export const tenantIdentityLabel = ({
  aggregate,
  units,
}: {
  aggregate: TenantAggregate;
  units: Unit[];
}): string => {
  const unitName =
    units.find((unit) => unit.id === aggregate.tenant.unitId)?.name ?? "";

  const residents = contractPartyNames(aggregate.residents);

  return residents
    ? t("ui.tenants.identityTitle", { residents, unit: unitName })
    : t("ui.tenants.identityTitleEmpty", { unit: unitName });
};

export type TenantRent = {
  id: string;
  tenantId: string;
  startDate: string | null;
  endDate: string | null;
  monthlyBaseRentCents: number;
  monthlyAdvanceCents: number;
  reductionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantBankAccount = {
  id: string;
  tenantId: string;
  startDate: string | null;
  endDate: string | null;
  iban: string;
  bic: string | null;
  accountHolder: string;
  mandateReference: string | null;
  mandateSignedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantAddress = {
  id: string;
  tenantId: string;
  startDate: string | null;
  endDate: string | null;
  street: string;
  postalCode: string;
  city: string;
  createdAt: string;
  updatedAt: string;
};

export type TenantAggregate = {
  tenant: Tenant;
  residents: TenantResidentLink[];
  rents: TenantRent[];
  bankAccounts: TenantBankAccount[];
  addresses: TenantAddress[];
};

export type TenantOverviewRow = {
  id: string;
  unitId: string;
  unitName: string;
  buildingId: string;
  buildingName: string;
  kind: TenantKind;
  startDate: string;
  endDate: string | null;
  contractResidents: { firstName: string; lastName: string }[];
  currentOccupants: number;
  currentRentCents: number | null;
  active: boolean;
};

export type TenantLink = {
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string | null;
  residentIds: string[];
};

export type TenantSortColumn =
  | "unit"
  | "building"
  | "kind"
  | "resident"
  | "term"
  | "rent"
  | "status"
  | "occupants";

export type TenantsOverviewParams = {
  page: number;
  pageSize: number;
  sort?: TenantSortColumn;
  order?: "asc" | "desc";
  q?: string;
  buildingId?: string;
};

export type TenantsOverviewResult = {
  items: TenantOverviewRow[];
  total: number;
};

export const tenantLinksQueryOptions = queryOptions({
  queryKey: ["tenants", "links"],
  queryFn: () => api.get<TenantLink[]>("/tenants/links"),
});

export const tenantQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["tenant", id],
    queryFn: () => api.get<TenantAggregate>(`/tenants/${id}`),
  });

export const tenantsOverviewQueryOptions = (params: TenantsOverviewParams) =>
  queryOptions({
    queryKey: ["tenants", "page", params],
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

      return api.get<TenantsOverviewResult>(`/tenants?${search.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

/**
 * Select-Optionen für Mietvertrags-Picker: "Wohnung - Vertragspartner",
 * ersatzweise nur der Wohnungsname. Geteilt von Payment-Create/-Edit.
 */
export const useTenantOptions = (tenants: TenantOverviewRow[]) =>
  useMemo(
    () =>
      tenants.map((tenant) => ({
        value: tenant.id,
        label:
          tenant.contractResidents.length > 0
            ? t("ui.tenants.summary", {
                unit: tenant.unitName,
                residents: tenant.contractResidents
                  .map((resident) =>
                    formatName(resident.firstName, resident.lastName),
                  )
                  .join(", "),
              })
            : tenant.unitName,
      })),
    [tenants],
  );
