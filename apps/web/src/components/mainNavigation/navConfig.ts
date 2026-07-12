import type { DomainKey } from "@/lib/domainVisuals";

export type NavItem = {
  to: string;
  labelKey: string;
  domain: DomainKey;
  exact?: boolean;
};

export const dashboardNav: NavItem[] = [
  {
    to: "/",
    labelKey: "ui.navigation.dashboard",
    domain: "dashboard",
    exact: true,
  },
  {
    to: "/einstellungen/absender",
    labelKey: "ui.navigation.configuration",
    domain: "configuration",
  },
];

/**
 * Gebäudegebundene Bereiche (alles unter dem Switcher).
 */
export const stammdatenNav: NavItem[] = [
  {
    to: "/wohnungen",
    labelKey: "ui.navigation.units",
    domain: "units",
  },
  {
    to: "/zaehler",
    labelKey: "ui.navigation.meters",
    domain: "meters",
  },
  {
    to: "/mieter",
    labelKey: "ui.navigation.tenants",
    domain: "tenants",
  },
];

export const kostenAbrechnungNav: NavItem[] = [
  {
    to: "/kostenarten",
    labelKey: "ui.navigation.costTypes",
    domain: "costTypes",
  },
  {
    to: "/rechnungen",
    labelKey: "ui.navigation.invoices",
    domain: "invoices",
  },
  {
    to: "/heizkosten",
    labelKey: "ui.navigation.heating",
    domain: "heating",
  },
  {
    to: "/abrechnungen",
    labelKey: "ui.navigation.statements",
    domain: "statements",
  },
];

export const isNavActive = (item: NavItem, path: string): boolean => {
  if (item.exact) {
    return path === item.to;
  }
  return path === item.to || path.startsWith(`${item.to}/`);
};
