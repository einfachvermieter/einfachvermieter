import {
  type RemixiconComponentType,
  RiBillLine,
  RiDashboard3Line,
  RiFileList3Line,
  RiFireLine,
  RiGroupLine,
  RiHome4Line,
  RiPriceTag3Line,
  RiSettings3Line,
  RiSpeedUpLine,
} from "@remixicon/react";

export type DomainKey =
  | "dashboard"
  | "configuration"
  | "units"
  | "meters"
  | "tenants"
  | "costTypes"
  | "invoices"
  | "heating"
  | "statements";

export type DomainVisual = {
  icon: RemixiconComponentType;
  accent: string;
};

/**
 * Feste Zuordnung Domäne → Icon + Akzentfarbe für Icon-Kacheln in Sidebar,
 * Tabellenzeilen und Sektionsköpfen.
 */
export const domainVisuals: Record<DomainKey, DomainVisual> = {
  dashboard: { icon: RiDashboard3Line, accent: "var(--i-blue)" },
  configuration: { icon: RiSettings3Line, accent: "var(--i-slate)" },
  units: { icon: RiHome4Line, accent: "var(--i-green)" },
  meters: { icon: RiSpeedUpLine, accent: "var(--i-cyan)" },
  tenants: { icon: RiGroupLine, accent: "var(--i-amber)" },
  costTypes: { icon: RiPriceTag3Line, accent: "var(--i-indigo)" },
  invoices: { icon: RiBillLine, accent: "var(--i-pink)" },
  heating: { icon: RiFireLine, accent: "var(--i-orange)" },
  statements: { icon: RiFileList3Line, accent: "var(--i-violet)" },
};

/**
 * Verläufe für Avatare, Hero-Kacheln und Sektions-Icons
 */
export const gradients = {
  brand: "linear-gradient(135deg, var(--color-sky-600), var(--color-teal-500))",
  units:
    "linear-gradient(135deg, var(--color-emerald-400), var(--color-green-600))",
  tenants:
    "linear-gradient(135deg, var(--color-amber-400), var(--color-amber-500))",
  heating:
    "linear-gradient(135deg, var(--color-orange-400), var(--color-orange-500))",
  water:
    "linear-gradient(135deg, var(--color-cyan-400), var(--color-cyan-500))",
  money:
    "linear-gradient(135deg, var(--color-green-500), var(--color-green-600))",
  bank: "linear-gradient(135deg, var(--color-sky-600), var(--color-sky-700))",
  address:
    "linear-gradient(135deg, var(--color-violet-500), var(--color-violet-700))",
  notes:
    "linear-gradient(135deg, var(--color-indigo-400), var(--color-indigo-600))",
} as const;
