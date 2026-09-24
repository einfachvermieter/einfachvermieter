import type { TranslateFn } from "@einfachvermieter/i18n";
import { formatNumberLoose } from "../format.js";
import type {
  CostEntry,
  CostLineResult,
  Period,
  UnitInfo,
  WaterDetail,
} from "../types/index.js";
import { distributeCents } from "./money.js";
import { prorationFactor } from "./period.js";

/**
 * Kostenzeile vor Zuordnung der `costTypeId`. Die Umlage kennt die Kostenart
 * noch nicht namentlich; der Aufrufer (`buildOperatingLines`) ergänzt die ID.
 */
type AllocatedLine = Omit<CostLineResult, "costTypeId">;

/**
 * Aggregiert alle Kostenrechnungen einer Kostenart in der Abrechnungsperiode.
 * Jede Rechnung wird tagesgenau anteilig zugeordnet.
 */
export const aggregateCostsForPeriod = (
  costs: CostEntry[],
  statementPeriod: Period,
): number => {
  let totalCents = 0;

  for (const cost of costs) {
    const factor = prorationFactor(
      { start: cost.periodStart, end: cost.periodEnd },
      statementPeriod,
    );

    totalCents += cost.amountCents * factor;
  }

  return Math.round(totalCents);
};

/**
 * Formatiert eine Personentage-Aufschlüsselung als "N Person(en) x M Tage".
 * Singular/Plural anhand der Personenanzahl.
 */
const formatPersonProduct = (
  count: number,
  days: number,
  translate: TranslateFn,
): string => translate("costs.baseExplain.personTimesDays", { count, days });

/**
 * Gemessener Verbrauch je Wohnung für eine Verbrauchsumlage. `landlord` ist
 * der Verbrauch der Ziel-Wohnung außerhalb der Mietzeit (Vor-/Nachmieter,
 * Leerstand), der als Kostenanteil auf den Vermieter fällt.
 */
export type MeasuredConsumption = {
  perUnit: Map<string, number>;
  landlord: number;
};

type AllocationContext = {
  units: UnitInfo[];
  targetUnitId: string;
  waterDetail?: WaterDetail;
  /**
   * kWh-Verbrauch der Zähler, die der Kostenart zugeordnet sind
   */
  kwhConsumption?: MeasuredConsumption;
  translate: TranslateFn;
};

type ResolvedAllocation = {
  costTypeName: string;
  totalAmountCents: number;
  units: UnitInfo[];
  targetUnitId: string;
  targetUnit: UnitInfo;
  waterDetail?: WaterDetail;
  kwhConsumption?: MeasuredConsumption;
  translate: TranslateFn;
};

/**
 * per_living_area: Flächentage (areaSqm x occupiedDays). Bei Leerstand
 * (occupiedDays < periodDays) fällt der entsprechende Anteil der Wohnung dem
 * Vermieter zu.
 */
const allocatePerLivingArea = ({
  costTypeName,
  totalAmountCents,
  units,
  targetUnitId,
  targetUnit,
  translate,
}: ResolvedAllocation): AllocatedLine => {
  const idx = units.findIndex((u) => u.id === targetUnitId);
  const tenantWeights = units.map((u) => u.areaSqm * u.occupiedDays);
  const totalAreaSqm = units.reduce((acc, u) => acc + u.areaSqm, 0);
  const { periodDays } = targetUnit;
  const maxBase = totalAreaSqm * periodDays;
  const sumTenantWeights = tenantWeights.reduce((a, b) => a + b, 0);
  const landlordWeight = Math.max(0, maxBase - sumTenantWeights);
  const allWeights = [...tenantWeights, landlordWeight];
  const shares = distributeCents(totalAmountCents, allWeights);
  const tenantAmountCents = shares[idx] ?? 0;
  const landlordAmountCents = shares.at(-1) ?? 0;
  const tenantBase = targetUnit.areaSqm * targetUnit.occupiedDays;
  const shareBps =
    maxBase > 0 ? Math.round((tenantBase / maxBase) * 10_000) : 0;
  const landlordShareBps =
    maxBase > 0 ? Math.round((landlordWeight / maxBase) * 10_000) : 0;

  return {
    costTypeName,
    allocationKey: "per_living_area",
    totalAmountCents,
    totalBase: maxBase,
    tenantBase,
    shareBps,
    tenantAmountCents,
    baseUnit: translate("costs.baseUnits.areaDays"),
    landlordAmountCents,
    landlordShareBps,
    tenantBaseExplain: translate("costs.baseExplain.areaTimesDays", {
      area: formatNumberLoose(targetUnit.areaSqm),
      days: targetUnit.occupiedDays,
    }),
    totalBaseExplain: translate("costs.baseExplain.areaTimesDays", {
      area: formatNumberLoose(totalAreaSqm),
      days: periodDays,
    }),
    bemessungTotal: totalAreaSqm,
    bemessungTenant: targetUnit.areaSqm,
    bemessungUnit: "m²",
    daysTotal: periodDays,
    daysTenant: targetUnit.occupiedDays,
  };
};

/**
 * per_heating_area: wie per_living_area, nur mit Heizfläche (Fallback
 * Wohnfläche) als Flächenbasis. Leerstand fällt als Differenz dem
 * Vermieter zu.
 */
const allocatePerHeatingArea = ({
  costTypeName,
  totalAmountCents,
  units,
  targetUnitId,
  targetUnit,
  translate,
}: ResolvedAllocation): AllocatedLine => {
  const heatingArea = (u: UnitInfo) => u.heatingAreaSqm ?? u.areaSqm;
  const idx = units.findIndex((u) => u.id === targetUnitId);
  const tenantWeights = units.map((u) => heatingArea(u) * u.occupiedDays);
  const totalHeatingAreaSqm = units.reduce((acc, u) => acc + heatingArea(u), 0);
  const { periodDays } = targetUnit;
  const maxBase = totalHeatingAreaSqm * periodDays;
  const sumTenantWeights = tenantWeights.reduce((a, b) => a + b, 0);
  const landlordWeight = Math.max(0, maxBase - sumTenantWeights);
  const allWeights = [...tenantWeights, landlordWeight];
  const shares = distributeCents(totalAmountCents, allWeights);
  const tenantAmountCents = shares[idx] ?? 0;
  const landlordAmountCents = shares.at(-1) ?? 0;
  const tenantBase = heatingArea(targetUnit) * targetUnit.occupiedDays;
  const shareBps =
    maxBase > 0 ? Math.round((tenantBase / maxBase) * 10_000) : 0;
  const landlordShareBps =
    maxBase > 0 ? Math.round((landlordWeight / maxBase) * 10_000) : 0;

  return {
    costTypeName,
    allocationKey: "per_heating_area",
    totalAmountCents,
    totalBase: maxBase,
    tenantBase,
    shareBps,
    tenantAmountCents,
    baseUnit: translate("costs.baseUnits.areaDays"),
    landlordAmountCents,
    landlordShareBps,
    tenantBaseExplain: translate("costs.baseExplain.areaTimesDays", {
      area: formatNumberLoose(heatingArea(targetUnit)),
      days: targetUnit.occupiedDays,
    }),
    totalBaseExplain: translate("costs.baseExplain.areaTimesDays", {
      area: formatNumberLoose(totalHeatingAreaSqm),
      days: periodDays,
    }),
    bemessungTotal: totalHeatingAreaSqm,
    bemessungTenant: heatingArea(targetUnit),
    bemessungUnit: "m²",
    daysTotal: periodDays,
    daysTenant: targetUnit.occupiedDays,
  };
};

/**
 * per_person: Personentage als Gewicht. Vermieter-Anteil bei Leerstand mit
 * Basis-Person-Regel: pro Leerstands-Tag wird 1 fiktive Person zu Lasten
 * Vermieter gerechnet.
 */
const allocatePerPerson = ({
  costTypeName,
  totalAmountCents,
  units,
  targetUnitId,
  targetUnit,
  translate,
}: ResolvedAllocation): AllocatedLine => {
  const tenantPersonDays = units.reduce((acc, u) => acc + u.personDays, 0);
  const { periodDays } = targetUnit;
  const totalUnitDays = units.length * periodDays;
  const totalOccupiedDays = units.reduce((acc, u) => acc + u.occupiedDays, 0);
  const landlordPersonDays = Math.max(0, totalUnitDays - totalOccupiedDays);
  const totalBase = tenantPersonDays + landlordPersonDays;
  const idx = units.findIndex((u) => u.id === targetUnitId);
  const tenantWeights = units.map((u) => u.personDays);
  const allWeights = [...tenantWeights, landlordPersonDays];
  const shares = distributeCents(totalAmountCents, allWeights);
  const tenantAmountCents = shares[idx] ?? 0;
  const landlordAmountCents = shares.at(-1) ?? 0;
  const shareBps =
    totalBase > 0
      ? Math.round((targetUnit.personDays / totalBase) * 10_000)
      : 0;
  const landlordShareBps =
    totalBase > 0 ? Math.round((landlordPersonDays / totalBase) * 10_000) : 0;

  // Klammer-Erklärung nur, wenn die Personentage einer Wohnung sich als
  // einfaches Produkt (alle Bewohner mit gleicher Spanne) darstellen lassen.
  // Sonst liefert der Belegungs-Anhang die Detail-Aufschlüsselung.
  const tenantUniform =
    targetUnit.occupantCount > 0 &&
    targetUnit.personDays ===
      targetUnit.occupantCount * targetUnit.occupiedDays;

  const tenantBaseExplain = tenantUniform
    ? formatPersonProduct(
        targetUnit.occupantCount,
        targetUnit.occupiedDays,
        translate,
      )
    : undefined;

  return {
    costTypeName,
    allocationKey: "per_person",
    totalAmountCents,
    totalBase,
    tenantBase: targetUnit.personDays,
    shareBps,
    tenantAmountCents,
    baseUnit: translate("costs.baseUnits.personDays"),
    landlordAmountCents,
    landlordShareBps,
    tenantBaseExplain,
    bemessungTotal: totalBase,
    bemessungTenant: targetUnit.personDays,
    bemessungUnit: "Personentage",
    daysTotal: null,
    daysTenant: null,
  };
};

/**
 * per_unit: wie per_living_area, nur Wohnungstage statt Flächentage als
 * Gewicht. Leerstand fällt als Differenz dem Vermieter zu.
 */
const allocatePerUnit = ({
  costTypeName,
  totalAmountCents,
  units,
  targetUnitId,
  targetUnit,
  translate,
}: ResolvedAllocation): AllocatedLine => {
  const idx = units.findIndex((u) => u.id === targetUnitId);
  const tenantWeights = units.map((u) => u.occupiedDays);
  const { periodDays } = targetUnit;
  const maxBase = units.length * periodDays;
  const sumTenantWeights = tenantWeights.reduce((a, b) => a + b, 0);
  const landlordWeight = Math.max(0, maxBase - sumTenantWeights);
  const allWeights = [...tenantWeights, landlordWeight];
  const shares = distributeCents(totalAmountCents, allWeights);
  const tenantAmountCents = shares[idx] ?? 0;
  const landlordAmountCents = shares.at(-1) ?? 0;
  const tenantBase = targetUnit.occupiedDays;
  const shareBps =
    maxBase > 0 ? Math.round((tenantBase / maxBase) * 10_000) : 0;
  const landlordShareBps =
    maxBase > 0 ? Math.round((landlordWeight / maxBase) * 10_000) : 0;

  return {
    costTypeName,
    allocationKey: "per_unit",
    totalAmountCents,
    totalBase: maxBase,
    tenantBase,
    shareBps,
    tenantAmountCents,
    baseUnit: translate("costs.baseUnits.unitDays"),
    landlordAmountCents,
    landlordShareBps,
    bemessungTotal: units.length,
    bemessungTenant: 1,
    bemessungUnit: "unit",
    daysTotal: periodDays,
    daysTenant: tenantBase,
  };
};

/**
 * Verteilung nach gemessenem Verbrauch (m³ oder kWh). Der Verbrauch der
 * Ziel-Wohnung außerhalb der Mietzeit fällt als Kostenanteil auf den
 * Vermieter und wird über das Statement des anderen Mieters wieder
 * eingesammelt.
 */
const allocateByMeasuredConsumption = (
  { costTypeName, totalAmountCents, units, targetUnitId }: ResolvedAllocation,
  measured: MeasuredConsumption,
  labels: {
    allocationKey: "per_consumption_m3" | "per_consumption_kwh";
    baseUnit: string;
    bemessungUnit: string;
  },
): AllocatedLine => {
  const weights = units.map((u) => measured.perUnit.get(u.id) ?? 0);
  // Bemessungsgrundlage ist die tatsächliche Gewichtssumme (nicht das
  // Hauptzähler-Total), ansonsten weicht der gedruckte Dreisatz von der
  // tatsächlichen Geldverteilung ab, sobald ein Differenzzähler fehlt.
  const totalBase =
    weights.reduce((sum, weight) => sum + weight, 0) + measured.landlord;
  const shares = distributeCents(totalAmountCents, [
    ...weights,
    measured.landlord,
  ]);
  const idx = units.findIndex((u) => u.id === targetUnitId);
  const tenantBase = measured.perUnit.get(targetUnitId) ?? 0;
  const tenantAmountCents = shares[idx] ?? 0;
  const landlordAmountCents = shares.at(-1) ?? 0;
  const shareBps =
    totalBase > 0 ? Math.round((tenantBase / totalBase) * 10_000) : 0;
  const landlordShareBps =
    totalBase > 0 ? Math.round((measured.landlord / totalBase) * 10_000) : 0;

  return {
    costTypeName,
    allocationKey: labels.allocationKey,
    totalAmountCents,
    totalBase,
    tenantBase,
    shareBps,
    tenantAmountCents,
    baseUnit: labels.baseUnit,
    landlordAmountCents,
    landlordShareBps,
    bemessungTotal: totalBase,
    bemessungTenant: tenantBase,
    bemessungUnit: labels.bemessungUnit,
    daysTotal: null,
    daysTenant: null,
  };
};

/**
 * per_consumption_m3: Verteilung nach gemessenem Wasserverbrauch
 */
const allocatePerConsumptionM3 = (
  resolved: ResolvedAllocation,
): AllocatedLine => {
  const { waterDetail, costTypeName, translate } = resolved;
  if (!waterDetail) {
    throw new Error(
      `per_consumption_m3 for "${costTypeName}" requires waterDetail in context`,
    );
  }

  return allocateByMeasuredConsumption(
    resolved,
    {
      perUnit: new Map(
        waterDetail.perUnit.map((entry) => [entry.unitId, entry.consumptionM3]),
      ),
      landlord: waterDetail.landlordConsumptionM3 ?? 0,
    },
    {
      allocationKey: "per_consumption_m3",
      baseUnit: translate("costs.baseUnits.consumptionM3"),
      bemessungUnit: "m³",
    },
  );
};

/**
 * per_consumption_kwh: Verteilung nach dem kWh-Verbrauch der Zähler, die der
 * Kostenart zugeordnet sind (z. B. Wärmepumpenstrom mit Wohnungszählern)
 */
const allocatePerConsumptionKwh = (
  resolved: ResolvedAllocation,
): AllocatedLine => {
  const { kwhConsumption, costTypeName, translate } = resolved;
  if (!kwhConsumption) {
    throw new Error(
      `per_consumption_kwh for "${costTypeName}" requires kwhConsumption in context`,
    );
  }

  return allocateByMeasuredConsumption(resolved, kwhConsumption, {
    allocationKey: "per_consumption_kwh",
    baseUnit: translate("costs.baseUnits.consumptionKwh"),
    bemessungUnit: "kWh",
  });
};

/**
 * fixed: fester Betrag komplett auf den Mieter, keine Umlage.
 */
const allocateFixed = ({
  costTypeName,
  totalAmountCents,
  translate,
}: ResolvedAllocation): AllocatedLine => ({
  costTypeName,
  allocationKey: "fixed",
  totalAmountCents,
  totalBase: 1,
  tenantBase: 1,
  shareBps: 10_000,
  tenantAmountCents: totalAmountCents,
  baseUnit: translate("costs.baseUnits.flatRate"),
  landlordAmountCents: 0,
  landlordShareBps: 0,
  bemessungTotal: null,
  bemessungTenant: null,
  bemessungUnit: null,
  daysTotal: null,
  daysTenant: null,
});

/**
 * Berechnet den Anteil einer Unit an Gesamtkosten nach dem jeweiligen
 * Umlageschlüssel
 */
export const allocateCost = (
  costTypeName: string,
  allocationKey: CostEntry["allocationKey"],
  totalAmountCents: number,
  ctx: AllocationContext,
): AllocatedLine => {
  const { units, targetUnitId, waterDetail, kwhConsumption, translate } = ctx;

  const targetUnit = units.find((u) => u.id === targetUnitId);
  if (!targetUnit) {
    throw new Error(`Unit ${targetUnitId} not found`);
  }

  const resolved: ResolvedAllocation = {
    costTypeName,
    totalAmountCents,
    units,
    targetUnitId,
    targetUnit,
    waterDetail,
    kwhConsumption,
    translate,
  };

  switch (allocationKey) {
    case "per_living_area":
      return allocatePerLivingArea(resolved);

    case "per_heating_area":
      return allocatePerHeatingArea(resolved);

    case "per_person":
      return allocatePerPerson(resolved);

    case "per_unit":
      return allocatePerUnit(resolved);

    case "per_consumption_m3":
      return allocatePerConsumptionM3(resolved);

    case "per_consumption_kwh":
      return allocatePerConsumptionKwh(resolved);

    case "fixed":
      return allocateFixed(resolved);

    case "heating_ordinance": {
      // Darf nie direkt aufgerufen werden. Heizkosten gehen durch
      // calculateHeating(). Der Caller muss das Ergebnis in eine
      // CostLineResult konvertieren.
      throw new Error(
        "heating_ordinance must not be routed through allocateCost - use calculateHeating()",
      );
    }

    default: {
      throw new Error(`Unknown allocationKey: ${String(allocationKey)}`);
    }
  }
};
