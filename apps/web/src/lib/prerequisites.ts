import {
  type RemixiconComponentType,
  RiBuilding2Line,
  RiGroupLine,
  RiHome4Line,
  RiPriceTag3Line,
} from "@remixicon/react";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useActiveBuilding } from "./activeBuilding";
import { buildingsQueryOptions, readStoredBuildingId } from "./buildings";
import { costTypesQueryOptions } from "./costs";
import { tenantsOverviewQueryOptions } from "./tenants";
import { unitsQueryOptions } from "./units";

/**
 * Entität, deren Existenz das Anlegen einer anderen Entität voraussetzt.
 */
type Prerequisite = "building" | "units" | "costTypes" | "tenants";

/**
 * Icon + Zielliste je Voraussetzung. Der Empty-State und der Redirect
 * verlinken auf die Liste dieser Entität, damit der Nutzer sie anlegen kann.
 */
export const NEEDS_META = {
  building: { linkTo: "/gebaeude", icon: RiBuilding2Line },
  units: { linkTo: "/wohnungen", icon: RiHome4Line },
  costTypes: { linkTo: "/kostenarten", icon: RiPriceTag3Line },
  tenants: { linkTo: "/mieter", icon: RiGroupLine },
} as const satisfies Record<
  Prerequisite,
  { linkTo: string; icon: RemixiconComponentType }
>;

/**
 * Anlage-Voraussetzungen je Domäne (abhängige Entität B). `needs` = Entität A,
 * die zuerst existieren muss; `listTo` = Liste von B als Redirect-Ziel, falls
 * die Anlage-Route ohne erfüllte Voraussetzung aufgerufen wird.
 */
export const PREREQUISITES = {
  units: { needs: "building", listTo: "/wohnungen" },
  costTypes: { needs: "building", listTo: "/kostenarten" },
  meters: { needs: "units", listTo: "/zaehler" },
  tenants: { needs: "units", listTo: "/mieter" },
  heating: { needs: "units", listTo: "/heizkosten" },
  invoices: { needs: "costTypes", listTo: "/rechnungen" },
  statements: { needs: "tenants", listTo: "/abrechnungen" },
} as const satisfies Record<string, { needs: Prerequisite; listTo: string }>;

export type GatedDomain = keyof typeof PREREQUISITES;

/**
 * Prüft im Frontend, ob die Anlage-Voraussetzung einer Domäne fürs aktive
 * Gebäude erfüllt ist. Steuert Button-Sichtbarkeit und Empty-State.
 */
export const usePrerequisite = (domain: GatedDomain) => {
  const config = PREREQUISITES[domain];
  const { buildingId, isPending: buildingsPending } = useActiveBuilding();

  const unitsQuery = useQuery({
    ...unitsQueryOptions,
    enabled: config.needs === "units" && buildingId !== undefined,
  });
  const costTypesQuery = useQuery({
    ...costTypesQueryOptions,
    enabled: config.needs === "costTypes" && buildingId !== undefined,
  });
  const tenantsQuery = useQuery({
    ...tenantsOverviewQueryOptions({ page: 0, pageSize: 1, buildingId }),
    enabled: config.needs === "tenants" && buildingId !== undefined,
  });

  if (config.needs === "building") {
    return { met: buildingId !== undefined, isPending: buildingsPending };
  }
  if (buildingId === undefined) {
    return { met: false, isPending: buildingsPending };
  }

  switch (config.needs) {
    case "units":
      return {
        met: (unitsQuery.data ?? []).some(
          (unit) => unit.buildingId === buildingId,
        ),
        isPending: buildingsPending || unitsQuery.isPending,
      };

    case "costTypes":
      return {
        met: (costTypesQuery.data ?? []).some(
          (costType) => costType.buildingId === buildingId,
        ),
        isPending: buildingsPending || costTypesQuery.isPending,
      };

    default:
      return {
        met: (tenantsQuery.data?.total ?? 0) > 0,
        isPending: buildingsPending || tenantsQuery.isPending,
      };
  }
};

/**
 * Prüft dieselbe Voraussetzung im Router-Guard (`beforeLoad`). Ohne Hooks,
 * deshalb wird das aktive Gebäude aus Suchparam, Store oder erstem Gebäude
 * aufgelöst und über den Query-Cache geladen.
 */
export const ensurePrerequisiteMet = async (
  queryClient: QueryClient,
  domain: GatedDomain,
  search: { buildingId?: string },
): Promise<boolean> => {
  const config = PREREQUISITES[domain];
  const buildings = await queryClient.ensureQueryData(buildingsQueryOptions);
  const exists = (id: string | undefined): id is string =>
    id !== undefined && buildings.some((building) => building.id === id);

  const [firstBuilding] = buildings;
  const buildingId = [
    search.buildingId,
    readStoredBuildingId(),
    firstBuilding?.id,
  ].find(exists);

  if (config.needs === "building") {
    return buildingId !== undefined;
  }

  if (buildingId === undefined) {
    return false;
  }

  switch (config.needs) {
    case "units": {
      const units = await queryClient.ensureQueryData(unitsQueryOptions);
      return units.some((unit) => unit.buildingId === buildingId);
    }

    case "costTypes": {
      const costTypes = await queryClient.ensureQueryData(
        costTypesQueryOptions,
      );
      return costTypes.some((costType) => costType.buildingId === buildingId);
    }

    default: {
      const result = await queryClient.ensureQueryData(
        tenantsOverviewQueryOptions({ page: 0, pageSize: 1, buildingId }),
      );
      return result.total > 0;
    }
  }
};
