import {
  type CostEntry,
  type CostLineResult,
  type HeatingDetail,
  type Period,
  STATEMENT_RESULT_VERSION,
  type StatementResult,
  type UnitInfo,
  type WaterDetail,
} from "../types/index.js";
import {
  STATEMENT_HEATING_COST_TYPE_ID,
  STATEMENT_HOT_WATER_COST_TYPE_ID,
} from "./advance.js";
import { aggregateCostsForPeriod, allocateCost } from "./allocation.js";
import { calculateWater, type WaterMeterBundle } from "./water.js";

export type StatementCalculationInput = {
  /**
   * Bezugsrahmen der Abrechnung (z. B. Kalenderjahr). Auf diese Periode
   * werden die Betriebskosten aggregiert und umgelegt
   */
  period: Period;
  /**
   * Schnittmenge aus Mieter-Vertragslaufzeit und Statement-Periode. Wird für
   * Wasser-Zählerstand-Extrapolation (Verbrauch nur in Mietzeit) sowie für
   * den Mieter-Anteil-Bezug in der Anzeige verwendet.
   */
  tenantPeriod?: Period;
  units: UnitInfo[];
  targetTenantId: string;
  targetUnitId: string;
  costTypes: Array<{
    id: string;
    name: string;
    allocationKey: CostEntry["allocationKey"];
    costs: CostEntry[];
  }>;
  waterMeters: WaterMeterBundle[];
  /**
   * Vorab berechnetes Heizkosten-Detail.
   * Interner Modus: via calculateHeating() aus Wärmemengenzähler-Daten.
   * Externer Modus: via calculateExternalHeating() aus manuell erfassten
   * Endbeträgen pro Wohnung.
   */
  heatingDetail: HeatingDetail;
  totalAdvancesCents: number;
};

/**
 * Baut eine zusammengefasste Heizkosten-/Warmwasser-Zeile (Bezug = ganzer
 * Topf = 100 %, Tenant-Anteil als Quote).
 *
 * @param hasSplit false falls extern abgerechneter Fall (kein Grund-/Verbrauchs-Split).
 * @returns null, wenn der Topf leer ist
 *
 * @todo i18n
 */
const buildHeatingTypeLine = (args: {
  costTypeId: string;
  costTypeName: string;
  potCents: number;
  tenantAmountCents: number;
  landlordAmountCents: number;
  consumptionShareBps: number;
  hasSplit: boolean;
}): CostLineResult | null => {
  if (args.potCents <= 0) {
    return null;
  }

  const basicShareBps = 10_000 - args.consumptionShareBps;
  const baseUnit = args.hasSplit
    ? `${args.consumptionShareBps / 100} % Verbrauch / ${
        basicShareBps / 100
      } % Fläche`
    : "Extern abgerechnet";

  return {
    costTypeId: args.costTypeId,
    costTypeName: args.costTypeName,
    allocationKey: "heating_ordinance",
    totalAmountCents: args.potCents,
    totalBase: 100,
    tenantBase: Math.round((args.tenantAmountCents / args.potCents) * 100),
    shareBps: Math.round((args.tenantAmountCents / args.potCents) * 10_000),
    tenantAmountCents: args.tenantAmountCents,
    baseUnit,
    bemessungTotal: null,
    bemessungTenant: null,
    bemessungUnit: null,
    daysTotal: null,
    daysTenant: null,
    landlordAmountCents: args.landlordAmountCents,
    landlordShareBps: Math.round(
      (args.landlordAmountCents / args.potCents) * 10_000,
    ),
    notes: args.hasSplit
      ? "Berechnung gemäß Heizkostenverordnung, Details im Anhang"
      : "Extern abgerechnete Heizkosten, Details im Anhang",
  };
};

/**
 * Baut die Heizkosten-Zeilen aus dem vorab berechneten HeatingDetail. Bei
 * aktiver Warmwasser-Abspaltung getrennte Positionen "Heizung"
 * und "Warmwasser", sonst eine kombinierte Heizkostenzeile.
 */
const buildHeatingLines = (
  heatingDetail: HeatingDetail,
  targetUnitId: string,
): CostLineResult[] => {
  const tenantHeatingShare = heatingDetail.perUnit.find(
    (p) => p.unitId === targetUnitId,
  );

  if (!tenantHeatingShare) {
    throw new Error(`No heating share computed for unit ${targetUnitId}`);
  }

  const {
    totalHeatingCostsCents,
    consumptionShareBps,
    consumptionPortionCents,
    basicPortionCents,
    hotWaterDetail,
  } = heatingDetail;
  const hasSplit = consumptionPortionCents > 0 || basicPortionCents > 0;
  const landlordHeatingCents =
    (heatingDetail.landlordBasicCostCents ?? 0) +
    (heatingDetail.landlordConsumptionCostCents ?? 0);

  const lines: CostLineResult[] = [];
  const push = (line: CostLineResult | null): void => {
    if (line) {
      lines.push(line);
    }
  };

  if (!hotWaterDetail) {
    // Ohne Abspaltung: eine kombinierte Heizkostenzeile (Bestandsverhalten).
    push(
      buildHeatingTypeLine({
        costTypeId: STATEMENT_HEATING_COST_TYPE_ID,
        costTypeName: "Heizkosten",
        potCents: totalHeatingCostsCents,
        tenantAmountCents: tenantHeatingShare.totalCents,
        landlordAmountCents: landlordHeatingCents,
        consumptionShareBps,
        hasSplit,
      }),
    );

    return lines;
  }

  // Warmwasser-Abspaltung aktiv -> getrennte Positionen "Heizung" und
  // "Warmwasser". Die Heizungszeile bezieht sich nur noch auf den um das
  // Warmwasser reduzierten Topf.
  const heatingPotCents =
    heatingDetail.heatingPotCents ??
    totalHeatingCostsCents - hotWaterDetail.hotWaterPotCents;

  push(
    buildHeatingTypeLine({
      costTypeId: STATEMENT_HEATING_COST_TYPE_ID,
      costTypeName: "Heizung",
      potCents: heatingPotCents,
      tenantAmountCents: tenantHeatingShare.totalCents,
      landlordAmountCents: landlordHeatingCents,
      consumptionShareBps,
      hasSplit,
    }),
  );

  const tenantHotWaterShare = hotWaterDetail.perUnit.find(
    (p) => p.unitId === targetUnitId,
  );

  push(
    buildHeatingTypeLine({
      costTypeId: STATEMENT_HOT_WATER_COST_TYPE_ID,
      costTypeName: "Warmwasser",
      potCents: hotWaterDetail.hotWaterPotCents,
      tenantAmountCents: tenantHotWaterShare?.totalCents ?? 0,
      landlordAmountCents:
        hotWaterDetail.landlordBasicCostCents +
        hotWaterDetail.landlordConsumptionCostCents,
      consumptionShareBps: hotWaterDetail.consumptionShareBps,
      hasSplit: true,
    }),
  );

  return lines;
};

/**
 * Legt alle Betriebskostenarten pro Tenant um. Heizkostenpositionen fließen
 * separat über `buildHeatingLines`. "fixed"-Positionen
 * zählen nur für ihre Ziel-Wohnung (kein Duplizieren auf jeden Mieter).
 */
const buildOperatingLines = (
  costTypes: StatementCalculationInput["costTypes"],
  period: Period,
  ctx: { units: UnitInfo[]; targetUnitId: string; waterDetail: WaterDetail },
): CostLineResult[] => {
  const lines: CostLineResult[] = [];

  for (const costType of costTypes) {
    if (costType.allocationKey === "heating_ordinance") {
      continue;
    }

    const relevantCosts =
      costType.allocationKey === "fixed"
        ? costType.costs.filter((cost) => cost.unitId === ctx.targetUnitId)
        : costType.costs;

    const totalAmountCents = aggregateCostsForPeriod(relevantCosts, period);
    if (totalAmountCents === 0) {
      continue;
    }

    const line = allocateCost(
      costType.name,
      costType.allocationKey,
      totalAmountCents,
      {
        units: ctx.units,
        targetUnitId: ctx.targetUnitId,
        waterDetail: ctx.waterDetail,
      },
    );

    lines.push({ ...line, costTypeId: costType.id });
  }

  return lines;
};

/**
 * Orchestriert die komplette Nebenkostenabrechnung für einen Tenant.
 *
 * Ablauf:
 * 1. Wasserverbrauch berechnen (nötig für per_consumption_m3)
 * 2. Heizkosten-Zeile aus vorab berechnetem HeatingDetail bauen
 * 3. Alle übrigen Kostenarten pro Tenant umlegen
 * 4. Schmutzwasser-Sonderfall: an Frischwasseranteil gekoppelt
 * 5. Summen und Saldo berechnen
 */
export const calculateStatement = (
  input: StatementCalculationInput,
): StatementResult => {
  const {
    period,
    tenantPeriod,
    units,
    targetTenantId,
    targetUnitId,
    costTypes,
    waterMeters,
    heatingDetail,
    totalAdvancesCents,
  } = input;
  const consumptionPeriod = tenantPeriod ?? period;

  // 1. Wasserverbrauch - Zählerstände nur über den Mieter-Zeitraum
  // ablesen, damit Verbrauch vor Einzug bzw. nach Auszug nicht
  // extrapoliert wird.
  const waterDetail: WaterDetail = calculateWater({
    units,
    waterMeters,
    periodStart: consumptionPeriod.start,
    periodEnd: consumptionPeriod.end,
  });

  // 2. Kostenzeilen: Heizkosten (aus HeatingDetail) + umgelegte Betriebskosten.
  const lines: CostLineResult[] = [
    ...buildHeatingLines(heatingDetail, targetUnitId),
    ...buildOperatingLines(costTypes, period, {
      units,
      targetUnitId,
      waterDetail,
    }),
  ];

  // 3. Summen
  const totalCostsCents = lines.reduce(
    (acc, line) => acc + line.tenantAmountCents,
    0,
  );
  const balanceCents = totalCostsCents - totalAdvancesCents;

  return {
    version: STATEMENT_RESULT_VERSION,
    tenantId: targetTenantId,
    unitId: targetUnitId,
    period,
    tenantPeriod: consumptionPeriod,
    lines,
    totalCostsCents,
    totalAdvancesCents,
    balanceCents,
    waterDetail,
    heatingDetail,
  };
};
