import type { HeatingFormValues } from "@einfachvermieter/shared";
import {
  type RemixiconComponentType,
  RiDashboard3Line,
  RiExternalLinkLine,
  RiForbidLine,
  RiPercentLine,
} from "@remixicon/react";

/**
 * UI-Schlüssel für die kombinierte Auswahl Abrechnungsmodus + Verbrauchs-
 * erfassung.
 */
export const billingTypes = [
  "internal_heat_cost_allocator",
  "internal_heat_meter",
  "external",
  "none",
] as const;
export type BillingType = (typeof billingTypes)[number];

export const toBillingType = (
  values: Pick<HeatingFormValues, "mode" | "consumptionMethod">,
): BillingType => {
  if (values.mode !== "internal") {
    return values.mode;
  }
  return values.consumptionMethod === "heat_cost_allocator"
    ? "internal_heat_cost_allocator"
    : "internal_heat_meter";
};

export const billingTypeIcon = (value: BillingType): RemixiconComponentType => {
  if (value === "external") {
    return RiExternalLinkLine;
  }

  if (value === "none") {
    return RiForbidLine;
  }

  return value === "internal_heat_cost_allocator"
    ? RiPercentLine
    : RiDashboard3Line;
};
