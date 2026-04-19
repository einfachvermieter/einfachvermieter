import {
  RiBillFill,
  RiBillLine,
  RiDashboard3Fill,
  RiDashboard3Line,
  RiDashboardFill,
  RiDashboardLine,
  RiFileList3Fill,
  RiFileList3Line,
  RiFireFill,
  RiFireLine,
  RiHome6Fill,
  RiHome6Line,
  RiPriceTag3Fill,
  RiPriceTag3Line,
  RiSettings3Fill,
  RiSettings3Line,
  RiTeamFill,
  RiTeamLine,
} from "@remixicon/react";
import type { ElementType } from "react";

export type NavItem = {
  to: string;
  labelKey: string;
  icon: ElementType;
  iconActive: ElementType;
  exact?: boolean;
};

export const dashboardNav: NavItem[] = [
  {
    to: "/",
    labelKey: "ui.navigation.dashboard",
    icon: RiDashboardLine,
    iconActive: RiDashboardFill,
    exact: true,
  },
  {
    to: "/einstellungen/absender",
    labelKey: "ui.navigation.configuration",
    icon: RiSettings3Line,
    iconActive: RiSettings3Fill,
  },
];

// Gebäudegebundene Bereiche (alles unter dem Switcher).
export const stammdatenNav: NavItem[] = [
  {
    to: "/wohnungen",
    labelKey: "ui.navigation.units",
    icon: RiHome6Line,
    iconActive: RiHome6Fill,
  },
  {
    to: "/zaehler",
    labelKey: "ui.navigation.meters",
    icon: RiDashboard3Line,
    iconActive: RiDashboard3Fill,
  },
  {
    to: "/mieter",
    labelKey: "ui.navigation.tenants",
    icon: RiTeamLine,
    iconActive: RiTeamFill,
  },
];

export const kostenAbrechnungNav: NavItem[] = [
  {
    to: "/kostenarten",
    labelKey: "ui.navigation.costTypes",
    icon: RiPriceTag3Line,
    iconActive: RiPriceTag3Fill,
  },
  {
    to: "/rechnungen",
    labelKey: "ui.navigation.invoices",
    icon: RiBillLine,
    iconActive: RiBillFill,
  },
  {
    to: "/heizkosten",
    labelKey: "ui.navigation.heating",
    icon: RiFireLine,
    iconActive: RiFireFill,
  },
  {
    to: "/abrechnungen",
    labelKey: "ui.navigation.statements",
    icon: RiFileList3Line,
    iconActive: RiFileList3Fill,
  },
];

export const isNavActive = (item: NavItem, path: string): boolean => {
  if (item.exact) {
    return path === item.to;
  }
  return path === item.to || path.startsWith(`${item.to}/`);
};
