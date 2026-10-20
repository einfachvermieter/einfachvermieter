import type { MeterType } from "@einfachvermieter/shared";
import {
  type RemixiconComponentType,
  RiDropLine,
  RiFlashlightLine,
} from "@remixicon/react";
import type { ComponentType } from "react";
import {
  IconBuilding,
  IconDoc,
  IconDoor,
  IconFlame,
  IconGauge,
  IconGear,
  IconHome,
  IconReceipt,
  IconTag,
  IconUsers,
} from "@/lib/icons";
import {
  ArtBuildings,
  ArtCostTypes,
  ArtDashboard,
  ArtHeating,
  ArtInvoices,
  ArtMeters,
  ArtSettings,
  ArtStatements,
  ArtTenants,
  ArtUnits,
} from "./illustrations";

export type DomainKey =
  | "dashboard"
  | "configuration"
  | "buildings"
  | "units"
  | "meters"
  | "tenants"
  | "costTypes"
  | "invoices"
  | "heating"
  | "statements";

export type DomainVisual = {
  icon: RemixiconComponentType;
  art: ComponentType<{ className?: string }>;
};

/**
 * Feste Zuordnung Domäne -> Icon für Sidebar, Seitenköpfe und Abschnitte
 */
export const domainVisuals: Record<DomainKey, DomainVisual> = {
  dashboard: { icon: IconHome, art: ArtDashboard },
  configuration: { icon: IconGear, art: ArtSettings },
  buildings: { icon: IconBuilding, art: ArtBuildings },
  units: { icon: IconDoor, art: ArtUnits },
  meters: { icon: IconGauge, art: ArtMeters },
  tenants: { icon: IconUsers, art: ArtTenants },
  costTypes: { icon: IconTag, art: ArtCostTypes },
  invoices: { icon: IconReceipt, art: ArtInvoices },
  heating: { icon: IconFlame, art: ArtHeating },
  statements: { icon: IconDoc, art: ArtStatements },
};

/**
 * Icon nach Kostenart-Charakter: Heizung Feuer, Wasser (m3) Tropfen,
 * Strom (kWh) Blitz, sonst Preisschild
 */
export const costTypeVisual = (costType: {
  category: string;
  defaultAllocationKey: string | null;
}): { icon: RemixiconComponentType } => {
  if (costType.category === "heating") {
    return { icon: IconFlame };
  }

  if (costType.defaultAllocationKey === "per_consumption_m3") {
    return { icon: RiDropLine };
  }

  if (costType.defaultAllocationKey === "per_consumption_kwh") {
    return { icon: RiFlashlightLine };
  }

  return { icon: IconTag };
};

/**
 * Zählertyp -> Icon (Wasser Tropfen, Wärme/Gas Feuer, Strom Blitz)
 */
export const meterTypeVisual = (
  type: MeterType,
): { icon: RemixiconComponentType } => {
  switch (type) {
    case "water_cold":
    case "water_hot":
      return { icon: RiDropLine };

    case "electricity":
      return { icon: RiFlashlightLine };

    default:
      return { icon: IconFlame };
  }
};
