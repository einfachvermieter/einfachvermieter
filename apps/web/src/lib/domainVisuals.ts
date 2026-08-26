import type { MeterType } from "@einfachvermieter/shared";
import {
  type RemixiconComponentType,
  RiCommunityLine,
  RiDashboard2Line,
  RiDashboardLine,
  RiDropLine,
  RiFileList3Line,
  RiFireLine,
  RiFlashlightLine,
  RiGroupLine,
  RiHome6Line,
  RiPriceTag3Line,
  RiReceiptLine,
  RiSettings3Line,
} from "@remixicon/react";

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
};

/**
 * Feste Zuordnung Domäne -> Icon für Sidebar, Seitenköpfe und Abschnitte
 */
export const domainVisuals: Record<DomainKey, DomainVisual> = {
  dashboard: { icon: RiDashboardLine },
  configuration: { icon: RiSettings3Line },
  buildings: { icon: RiCommunityLine },
  units: { icon: RiHome6Line },
  meters: { icon: RiDashboard2Line },
  tenants: { icon: RiGroupLine },
  costTypes: { icon: RiPriceTag3Line },
  invoices: { icon: RiReceiptLine },
  heating: { icon: RiFireLine },
  statements: { icon: RiFileList3Line },
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
    return { icon: RiFireLine };
  }

  if (costType.defaultAllocationKey === "per_consumption_m3") {
    return { icon: RiDropLine };
  }

  if (costType.defaultAllocationKey === "per_consumption_kwh") {
    return { icon: RiFlashlightLine };
  }

  return { icon: RiPriceTag3Line };
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
      return { icon: RiFireLine };
  }
};
