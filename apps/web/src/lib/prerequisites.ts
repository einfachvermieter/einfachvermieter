import {
  type RemixiconComponentType,
  RiBuilding2Line,
  RiGroupLine,
  RiHome6Line,
  RiPriceTag3Line,
  RiReceiptLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useActiveBuilding } from "./activeBuilding";
import {
  costEntriesOverviewQueryOptions,
  costTypesQueryOptions,
} from "./costs";
import { tenantsOverviewQueryOptions } from "./tenants";
import { unitsQueryOptions } from "./units";

/**
 * Entität, deren Existenz das Anlegen einer anderen Entität voraussetzt.
 */
type Prerequisite = "building" | "units" | "costTypes" | "tenants" | "invoices";

/**
 * Icon + Zielliste je Voraussetzung. Der Empty-State verlinkt auf die Liste
 * dieser Entität, damit der Nutzer sie anlegen kann.
 */
export const NEEDS_META = {
  building: { linkTo: "/gebaeude", icon: RiBuilding2Line },
  units: { linkTo: "/wohnungen", icon: RiHome6Line },
  costTypes: { linkTo: "/kostenarten", icon: RiPriceTag3Line },
  tenants: { linkTo: "/mieter", icon: RiGroupLine },
  invoices: { linkTo: "/rechnungen", icon: RiReceiptLine },
} as const satisfies Record<
  Prerequisite,
  { linkTo: string; icon: RemixiconComponentType }
>;

/**
 * Anlage-Voraussetzungen je Domäne: Entitäten, die zuerst existieren müssen.
 * Fehlen mehrere, nennt der Empty-State die erste in dieser Reihenfolge.
 */
export const PREREQUISITES = {
  units: ["building"],
  costTypes: ["building"],
  meters: ["units"],
  tenants: ["units"],
  heating: ["units"],
  invoices: ["costTypes"],
  statements: ["tenants", "invoices"],
} as const satisfies Record<string, readonly Prerequisite[]>;

export type GatedDomain = keyof typeof PREREQUISITES;

/**
 * Prüft im Frontend, ob die Anlage-Voraussetzungen einer Domäne fürs aktive
 * Gebäude erfüllt sind. Steuert Button-Sichtbarkeit und Empty-State;
 * `missing` ist die erste fehlende Voraussetzung.
 */
export const usePrerequisite = (domain: GatedDomain) => {
  const needs: readonly Prerequisite[] = PREREQUISITES[domain];
  const { buildingId, isPending: buildingsPending } = useActiveBuilding();
  const enabledFor = (prerequisite: Prerequisite) =>
    needs.includes(prerequisite) && buildingId !== undefined;

  const unitsQuery = useQuery({
    ...unitsQueryOptions,
    enabled: enabledFor("units"),
  });
  const costTypesQuery = useQuery({
    ...costTypesQueryOptions,
    enabled: enabledFor("costTypes"),
  });
  const tenantsQuery = useQuery({
    ...tenantsOverviewQueryOptions({ page: 0, pageSize: 1, buildingId }),
    enabled: enabledFor("tenants"),
  });
  const invoicesQuery = useQuery({
    ...costEntriesOverviewQueryOptions({ page: 0, pageSize: 1, buildingId }),
    enabled: enabledFor("invoices"),
  });

  const checks: Record<Prerequisite, { met: boolean; isPending: boolean }> = {
    building: { met: buildingId !== undefined, isPending: false },
    units: {
      met: (unitsQuery.data ?? []).some(
        (unit) => unit.buildingId === buildingId,
      ),
      isPending: unitsQuery.isPending,
    },
    costTypes: {
      met: (costTypesQuery.data ?? []).some(
        (costType) => costType.buildingId === buildingId,
      ),
      isPending: costTypesQuery.isPending,
    },
    tenants: {
      met: (tenantsQuery.data?.total ?? 0) > 0,
      isPending: tenantsQuery.isPending,
    },
    invoices: {
      met: (invoicesQuery.data?.total ?? 0) > 0,
      isPending: invoicesQuery.isPending,
    },
  };

  if (buildingId === undefined) {
    return { met: false, isPending: buildingsPending, missing: needs[0] };
  }

  const missing = needs.find((prerequisite) => !checks[prerequisite].met);

  return {
    met: missing === undefined,
    isPending:
      buildingsPending ||
      needs.some((prerequisite) => checks[prerequisite].isPending),
    missing,
  };
};
