import { formatNumberLoose } from "../format.js";
import type {
  CostEntry,
  CostLineResult,
  Period,
  UnitInfo,
  WaterDetail,
} from "../types/index.js";
import { CalculationError } from "./diagnostics.js";
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
 *
 * @todo i18n
 */
const formatPersonProduct = (count: number, days: number): string =>
  `${count} ${count === 1 ? "Person" : "Personen"} x ${days} Tage`;

type AllocationContext = {
  units: UnitInfo[];
  targetUnitId: string;
  waterDetail?: WaterDetail;
};

type ResolvedAllocation = {
  costTypeName: string;
  totalAmountCents: number;
  units: UnitInfo[];
  targetUnitId: string;
  targetUnit: UnitInfo;
  waterDetail?: WaterDetail;
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
    baseUnit: "m²·Tage",
    landlordAmountCents,
    landlordShareBps,
    tenantBaseExplain: `${formatNumberLoose(targetUnit.areaSqm)} m² × ${targetUnit.occupiedDays} Tage`,
    totalBaseExplain: `${formatNumberLoose(totalAreaSqm)} m² × ${periodDays} Tage`,
    bemessungTotal: totalAreaSqm,
    bemessungTenant: targetUnit.areaSqm,
    bemessungUnit: "m²",
    daysTotal: periodDays,
    daysTenant: targetUnit.occupiedDays,
  };
};

/**
 * per_heating_area: Verteilung nach Heizfläche (Fallback Wohnfläche).
 */
const allocatePerHeatingArea = ({
  costTypeName,
  totalAmountCents,
  units,
  targetUnitId,
  targetUnit,
}: ResolvedAllocation): AllocatedLine => {
  const heatingArea = (u: UnitInfo) => u.heatingAreaSqm ?? u.areaSqm;
  const totalBase = units.reduce((acc, u) => acc + heatingArea(u), 0);
  const weights = units.map(heatingArea);
  const shares = distributeCents(totalAmountCents, weights);
  const idx = units.findIndex((u) => u.id === targetUnitId);
  const tenantAmountCents = shares[idx] ?? 0;
  const tenantBase = heatingArea(targetUnit);
  const shareBps =
    totalBase > 0 ? Math.round((tenantBase / totalBase) * 10_000) : 0;

  return {
    costTypeName,
    allocationKey: "per_heating_area",
    totalAmountCents,
    totalBase,
    tenantBase,
    shareBps,
    tenantAmountCents,
    baseUnit: "m²",
    landlordAmountCents: 0,
    landlordShareBps: 0,
    bemessungTotal: totalBase,
    bemessungTenant: tenantBase,
    bemessungUnit: "m²",
    daysTotal: null,
    daysTenant: null,
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
    ? formatPersonProduct(targetUnit.occupantCount, targetUnit.occupiedDays)
    : undefined;

  return {
    costTypeName,
    allocationKey: "per_person",
    totalAmountCents,
    totalBase,
    tenantBase: targetUnit.personDays,
    shareBps,
    tenantAmountCents,
    baseUnit: "Personentage",
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
    baseUnit: "Wohnungstage",
    landlordAmountCents,
    landlordShareBps,
    tenantBaseExplain: `1 Wohnung × ${tenantBase} Tage`,
    totalBaseExplain: `${units.length} Wohnungen × ${periodDays} Tage`,
    bemessungTotal: units.length,
    bemessungTenant: 1,
    bemessungUnit: units.length === 1 ? "Wohnung" : "Wohnungen",
    daysTotal: periodDays,
    daysTenant: tenantBase,
  };
};

/**
 * per_consumption_m3: Verteilung nach gemessenem Wasserverbrauch. Der
 * Verbrauch der Ziel-Wohnung außerhalb der Mietzeit
 * (`landlordConsumptionM3`, Vor-/Nachmieter oder Leerstand) fällt als
 * Kostenanteil auf den Vermieter und wird über das Statement des anderen
 * Mieters wieder eingesammelt.
 */
const allocatePerConsumptionM3 = ({
  costTypeName,
  totalAmountCents,
  units,
  targetUnitId,
  waterDetail,
}: ResolvedAllocation): AllocatedLine => {
  if (!waterDetail) {
    throw new Error(
      `per_consumption_m3 for "${costTypeName}" requires waterDetail in context`,
    );
  }

  const totalBase = waterDetail.totalConsumptionM3;
  const landlordConsumptionM3 = waterDetail.landlordConsumptionM3 ?? 0;
  const weights = units.map((u) => {
    const entry = waterDetail.perUnit.find((p) => p.unitId === u.id);
    return entry?.consumptionM3 ?? 0;
  });
  const shares = distributeCents(totalAmountCents, [
    ...weights,
    landlordConsumptionM3,
  ]);
  const idx = units.findIndex((u) => u.id === targetUnitId);
  const tenantEntry = waterDetail.perUnit.find(
    (p) => p.unitId === targetUnitId,
  );
  const tenantBase = tenantEntry?.consumptionM3 ?? 0;
  const tenantAmountCents = shares[idx] ?? 0;
  const landlordAmountCents = shares.at(-1) ?? 0;
  const shareBps =
    totalBase > 0 ? Math.round((tenantBase / totalBase) * 10_000) : 0;
  const landlordShareBps =
    totalBase > 0
      ? Math.round((landlordConsumptionM3 / totalBase) * 10_000)
      : 0;

  return {
    costTypeName,
    allocationKey: "per_consumption_m3",
    totalAmountCents,
    totalBase,
    tenantBase,
    shareBps,
    tenantAmountCents,
    baseUnit: "m³",
    landlordAmountCents,
    landlordShareBps,
    bemessungTotal: totalBase,
    bemessungTenant: tenantBase,
    bemessungUnit: "m³",
    daysTotal: null,
    daysTenant: null,
  };
};

/**
 * fixed: fester Betrag komplett auf den Mieter, keine Umlage.
 */
const allocateFixed = ({
  costTypeName,
  totalAmountCents,
}: ResolvedAllocation): AllocatedLine => ({
  costTypeName,
  allocationKey: "fixed",
  totalAmountCents,
  totalBase: 1,
  tenantBase: 1,
  shareBps: 10_000,
  tenantAmountCents: totalAmountCents,
  baseUnit: "Pauschale",
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
  const { units, targetUnitId, waterDetail } = ctx;

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

    case "per_consumption_kwh": {
      // @todo: Sub-Zähler-basierte kWh-Verteilung (z. B. Allgemeinstrom mit
      // Wohnungs-Sub-Zählern). Verbrauchsquelle (analog zu waterDetail) ist
      // noch nicht eingebaut.
      throw new CalculationError("allocationKwhNotImplemented", {
        costTypeName,
      });
    }

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
