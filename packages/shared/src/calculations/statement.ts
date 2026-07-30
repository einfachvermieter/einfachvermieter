import type { TranslateFn } from "@einfachvermieter/i18n";
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
   * Schnittmenge aus Mieter-Vertragslaufzeit und Statement-Periode. Setzt
   * die Wasserzähler der Ziel-Wohnung auf die Mietzeit (Verbrauch außerhalb
   * fällt auf den Vermieter) und dient als Mieter-Anteil-Bezug in der
   * Anzeige.
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
   * Übersetzt Anzeige-Strings, die im Snapshot landen (Umlagebasis-
   * Einheiten und Bemessungs-Erklärungen).
   */
  translate: TranslateFn;
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
 */
const buildHeatingTypeLine = (args: {
  costTypeId: string;
  costTypeName: string;
  potCents: number;
  tenantAmountCents: number;
  landlordAmountCents: number;
  consumptionShareBps: number;
  hasSplit: boolean;
  translate: TranslateFn;
}): CostLineResult | null => {
  if (args.potCents === 0) {
    return null;
  }

  const basicShareBps = 10_000 - args.consumptionShareBps;
  const baseUnit = args.hasSplit
    ? args.translate("costs.heatingLines.splitShares", {
        consumption: args.consumptionShareBps / 100,
        basic: basicShareBps / 100,
      })
    : args.translate("costs.heatingLines.external");

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
      ? args.translate("costs.heatingLines.noteOrdinance")
      : args.translate("costs.heatingLines.noteExternal"),
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
  translate: TranslateFn,
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
        costTypeName: translate("costs.heatingLines.combined"),
        potCents: totalHeatingCostsCents,
        tenantAmountCents: tenantHeatingShare.totalCents,
        landlordAmountCents: landlordHeatingCents,
        consumptionShareBps,
        hasSplit,
        translate,
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
      costTypeName: translate("costs.heatingLines.heating"),
      potCents: heatingPotCents,
      tenantAmountCents: tenantHeatingShare.totalCents,
      landlordAmountCents: landlordHeatingCents,
      consumptionShareBps,
      hasSplit,
      translate,
    }),
  );

  const tenantHotWaterShare = hotWaterDetail.perUnit.find(
    (p) => p.unitId === targetUnitId,
  );

  push(
    buildHeatingTypeLine({
      costTypeId: STATEMENT_HOT_WATER_COST_TYPE_ID,
      costTypeName: translate("costs.heatingLines.hotWater"),
      potCents: hotWaterDetail.hotWaterPotCents,
      tenantAmountCents: tenantHotWaterShare?.totalCents ?? 0,
      landlordAmountCents:
        hotWaterDetail.landlordBasicCostCents +
        hotWaterDetail.landlordConsumptionCostCents,
      consumptionShareBps: hotWaterDetail.consumptionShareBps,
      hasSplit: true,
      translate,
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
  ctx: {
    units: UnitInfo[];
    targetUnitId: string;
    waterDetail: WaterDetail;
    tenantPeriod: Period;
    translate: TranslateFn;
  },
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

    // "fixed" geht komplett an den Ziel-Mieter. Deshalb zählt hier nur die
    // Mietzeit, sonst zahlen bei Mieterwechsel beide Mieter die volle
    // Pauschale. Alle anderen Schlüssel kürzen über die UnitInfo-Gewichte.
    const aggregationPeriod =
      costType.allocationKey === "fixed" ? ctx.tenantPeriod : period;
    const totalAmountCents = aggregateCostsForPeriod(
      relevantCosts,
      aggregationPeriod,
    );
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
        translate: ctx.translate,
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
 * 4. Verbrauchsumlagen ohne gemessenen Verbrauch anwarnen
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
    translate,
  } = input;
  const consumptionPeriod = tenantPeriod ?? period;

  // 1. Wasserverbrauch - Nenner (Hauptzähler, andere Wohnungen) über die
  // volle Statement-Periode, nur die Zähler der Ziel-Wohnung über den
  // Mieter-Zeitraum. Der Rest-Verbrauch der Ziel-Wohnung fällt als
  // Vermieteranteil an (Mieterwechsel/Leerstand) - sonst würde die
  // Verbrauchs-Quote der Mietzeit auf die Jahres-Kosten angewendet.
  const waterDetail: WaterDetail = calculateWater({
    units,
    waterMeters,
    periodStart: period.start,
    periodEnd: period.end,
    targetUnitId,
    tenantPeriodStart: tenantPeriod?.start,
    tenantPeriodEnd: tenantPeriod?.end,
  });

  // 2. Kostenzeilen: Heizkosten (aus HeatingDetail) + umgelegte Betriebskosten.
  const lines: CostLineResult[] = [
    ...buildHeatingLines(heatingDetail, targetUnitId, translate),
    ...buildOperatingLines(costTypes, period, {
      units,
      targetUnitId,
      waterDetail,
      tenantPeriod: consumptionPeriod,
      translate,
    }),
  ];

  // 4. Verbrauchsumlage ohne gemessenen Verbrauch: alle Gewichte sind 0, der
  // Betrag verteilt sich auf niemanden und fiele sonst kommentarlos aus der
  // Abrechnung.
  const unmeasuredLines = lines.filter(
    (line) =>
      line.allocationKey === "per_consumption_m3" && line.totalBase <= 0,
  );

  if (unmeasuredLines.length > 0) {
    waterDetail.warnings = [
      ...(waterDetail.warnings ?? []),
      ...unmeasuredLines.map((line) => ({
        code: "waterNoConsumption",
        params: { label: line.costTypeName },
      })),
    ];
  }

  // 5. Summen
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
