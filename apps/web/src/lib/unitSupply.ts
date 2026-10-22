import {
  type CalcWarning,
  formatDate,
  type SubstitutionScope,
  type UnitSupplyExclusion,
  type UnitSupplyExclusionWriteDto,
} from "@einfachvermieter/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "./api";
import { t } from "./i18n";

export const unitSupplyQueryOptions = (unitId: string) =>
  queryOptions({
    queryKey: ["unit-supply", unitId],
    queryFn: () =>
      api.get<UnitSupplyExclusion[]>(`/units/${unitId}/supply-exclusions`),
  });

/**
 * Nach einer Änderung rechnen auch die Abrechnungen des Gebäudes neu
 */
export const unitSupplyInvalidateKeys = [
  ["unit-supply"],
  ["statement-preview"],
] as const;

export const saveUnitSupplyExclusion = (
  unitId: string,
  existingId: string | null,
  dto: UnitSupplyExclusionWriteDto,
) =>
  existingId
    ? api.patch<UnitSupplyExclusion>(
        `/unit-supply-exclusions/${existingId}`,
        dto,
      )
    : api.post<UnitSupplyExclusion>(`/units/${unitId}/supply-exclusions`, dto);

export const deleteUnitSupplyExclusion = (id: string) =>
  api.delete(`/unit-supply-exclusions/${id}`);

export type UnitSupplyFormValues = {
  scope: SubstitutionScope;
  validFrom: string;
  validUntil: string;
  notes: string;
};

export const unitSupplyFormSchema = z
  .object({
    scope: z.enum(["heating", "hot_water"]),
    validFrom: z.string().min(1, t("ui.units.supply.validation.required")),
    validUntil: z.string(),
    notes: z.string(),
  })
  .refine(
    (value) => value.validUntil === "" || value.validUntil >= value.validFrom,
    { path: ["validUntil"], message: t("ui.units.supply.validation.range") },
  );

export const unitSupplyFormToDto = (
  values: UnitSupplyFormValues,
): UnitSupplyExclusionWriteDto => ({
  scope: values.scope,
  validFrom: values.validFrom,
  validUntil: values.validUntil === "" ? null : values.validUntil,
  notes: values.notes.trim() === "" ? null : values.notes.trim(),
});

/**
 * Zeile der Liste, z.B. "Warmwasser nicht aus der zentralen Anlage seit
 * 01.07.2027"
 */
export const unitSupplyRowLabel = (row: UnitSupplyExclusion): string => {
  const scope = t(`ui.units.supply.scope.${row.scope}`);

  return row.validUntil === null
    ? t("ui.units.supply.rowOpen", { scope, from: formatDate(row.validFrom) })
    : t("ui.units.supply.rowClosed", {
        scope,
        from: formatDate(row.validFrom),
        until: formatDate(row.validUntil),
      });
};

export type SupplyIssue = {
  key: string;
  kind:
    | "boundary"
    | "meterMissing"
    | "unsupportedCombination"
    | "heatingAreaZeroWithConsumption"
    | "heatingAreaNoAllocationBase";
  unitId: string;
  unit: string;
  scope: SubstitutionScope;
  meterId: string;
  meter: string;
  date: string;
};

const ISSUE_KINDS: Record<string, SupplyIssue["kind"]> = {
  supplyBoundaryReadingMissing: "boundary",
  consumptionMeterMissingHeating: "meterMissing",
  consumptionMeterMissingHotWater: "meterMissing",
  supplyChangeWithSubstitution: "unsupportedCombination",
  heatingAreaZeroWithConsumption: "heatingAreaZeroWithConsumption",
  heatingAreaNoAllocationBase: "heatingAreaNoAllocationBase",
};

/**
 * Offene Punkte zur zentralen Versorgung aus den Warnungen der Berechnung.
 * Keiner davon lässt sich mit einem Erfassungsausfall lösen.
 */
export const supplyIssuesOf = (
  warnings: CalcWarning[] | undefined,
): SupplyIssue[] =>
  (warnings ?? []).flatMap((warning) => {
    const kind = ISSUE_KINDS[warning.code];
    if (!kind) {
      return [];
    }
    const params = warning.params ?? {};

    return [
      {
        key: `${warning.code}|${params.unitId}|${params.meterId}|${params.date}`,
        kind,
        unitId: String(params.unitId ?? ""),
        unit: String(params.unit ?? ""),
        scope: params.scope === "hot_water" ? "hot_water" : "heating",
        meterId: String(params.meterId ?? ""),
        meter: String(params.label ?? ""),
        date: String(params.date ?? ""),
      },
    ];
  });
