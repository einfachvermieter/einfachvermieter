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
import { CalculationError, type CalcWarning } from "./diagnostics.js";
import { distributeCents } from "./money.js";
import type { MeterBundle } from "./virtualMeter.js";
import {
  aggregateUnitConsumption,
  calculateWater,
  dedupe,
  overlapsPeriod,
  type WaterMeterBundle,
} from "./water.js";

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
    meterIds?: string[];
  }>;
  waterMeters: WaterMeterBundle[];
  kwhMeters?: MeterBundle[];
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
   * Fehlt es, rechnet der Vermieter keine Heizung ab: kein Heizkostenteil.
   */
  heatingDetail?: HeatingDetail;
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

  // Ohne Zeile ist die Wohnung nicht an die zentrale Heizung angeschlossen
  // und trägt keinen Anteil. Fehlt sie aus einem anderen Grund, stimmt die
  // Berechnung nicht.
  if (!(tenantHeatingShare || heatingDetail.supply?.heating)) {
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
      tenantHeatingShare === undefined
        ? null
        : buildHeatingTypeLine({
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
    tenantHeatingShare
      ? buildHeatingTypeLine({
          costTypeId: STATEMENT_HEATING_COST_TYPE_ID,
          costTypeName: translate("costs.heatingLines.heating"),
          potCents: heatingPotCents,
          tenantAmountCents: tenantHeatingShare.totalCents,
          landlordAmountCents: landlordHeatingCents,
          consumptionShareBps,
          hasSplit,
          translate,
        })
      : null,
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

type OperatingCostType = StatementCalculationInput["costTypes"][number];

/**
 * Zähler aus dem Vorrat, die der Kostenart zugeordnet sind
 */
const assignedMeters = (
  costType: OperatingCostType,
  meters: MeterBundle[],
): MeterBundle[] => {
  const assignedIds = new Set(costType.meterIds ?? []);

  return meters.filter((bundle) => assignedIds.has(bundle.meter.id));
};

/**
 * Verbrauch je Wohnung aus den Zählern, die der Kostenart zugeordnet sind.
 * `sharedMeters` sind zugeordnete Allgemeinzähler ohne Wohnung.
 */
const measureAssignedConsumption = (
  costType: OperatingCostType,
  assigned: MeterBundle[],
  period: Period,
  ctx: {
    units: UnitInfo[];
    targetUnitId: string;
    tenantPeriod: Period;
    meters: MeterBundle[];
    warnings: CalcWarning[];
  },
) => {
  // Eine Wohnung ohne zugeordneten Zähler hat Verbrauch 0, die übrigen
  // tragen die ganze Rechnung. Nur Warnung: Eine Anlage kann bewusst nur
  // einen Teil der Wohnungen versorgen.
  const meteredUnitIds = new Set(assigned.map((bundle) => bundle.meter.unitId));
  for (const unit of ctx.units) {
    if (!meteredUnitIds.has(unit.id)) {
      ctx.warnings.push({
        code: "unitWithoutAssignedMeter",
        params: { label: unit.name, costTypeName: costType.name },
      });
    }
  }

  const { unitConsumption, landlordConsumptionM3, sharedMeters, unitMeters } =
    aggregateUnitConsumption({
      units: ctx.units,
      waterMeters: assigned,
      bundles: new Map(
        ctx.meters.map((bundle) => [bundle.meter.id, bundle] as const),
      ),
      periodStart: period.start,
      periodEnd: period.end,
      targetUnitId: ctx.targetUnitId,
      tenantStart: ctx.tenantPeriod.start,
      tenantEnd: ctx.tenantPeriod.end,
      warnings: ctx.warnings,
    });

  return {
    measured: { perUnit: unitConsumption, landlord: landlordConsumptionM3 },
    sharedMeters,
    targetMeters: unitMeters.get(ctx.targetUnitId) ?? [],
  };
};

/**
 * Kostenzeilen einer Verbrauchsumlage (m3 oder kWh) mit zugeordneten Zählern
 */
const buildAssignedLines = (
  costType: OperatingCostType,
  totalAmountCents: number,
  period: Period,
  ctx: {
    units: UnitInfo[];
    targetUnitId: string;
    waterDetail: WaterDetail | undefined;
    tenantPeriod: Period;
    assigned: MeterBundle[];
    meters: MeterBundle[];
    warnings: CalcWarning[];
    translate: TranslateFn;
  },
): CostLineResult[] => {
  const allocationContext = {
    units: ctx.units,
    targetUnitId: ctx.targetUnitId,
    waterDetail: ctx.waterDetail,
    translate: ctx.translate,
  };
  const { measured, sharedMeters, targetMeters } = measureAssignedConsumption(
    costType,
    ctx.assigned,
    period,
    ctx,
  );
  const unitTotal =
    [...measured.perUnit.values()].reduce((sum, value) => sum + value, 0) +
    measured.landlord;
  const sharedTotal = sharedMeters.reduce(
    (sum, shared) => sum + shared.consumptionM3,
    0,
  );

  if (
    costType.allocationKey === "per_consumption_kwh" &&
    unitTotal + sharedTotal <= 0
  ) {
    throw new CalculationError("allocationKwhNoConsumption", {
      costTypeName: costType.name,
    });
  }

  // Vorwegabzug: Der Verbrauch eines Allgemeinzählers ohne Wohnung (z.B.
  // Gartenwasser) nimmt seinen Anteil an der Rechnung mit und wird nach
  // Wohnfläche verteilt, der Rest nach dem Verbrauch der Wohnungen.
  const [unitCents = 0, ...sharedCents] =
    sharedTotal > 0
      ? distributeCents(totalAmountCents, [
          unitTotal,
          ...sharedMeters.map((shared) => shared.consumptionM3),
        ])
      : [totalAmountCents];

  const lines: CostLineResult[] = [];

  if (unitCents !== 0 || sharedTotal <= 0) {
    lines.push({
      ...allocateCost(costType.name, costType.allocationKey, unitCents, {
        ...allocationContext,
        measuredConsumption: measured,
      }),
      costTypeId: costType.id,
      ...(costType.allocationKey === "per_consumption_m3"
        ? { meterContributions: targetMeters }
        : {}),
    });
  }

  sharedMeters.forEach((shared, index) => {
    const cents = sharedCents[index] ?? 0;
    if (cents !== 0) {
      lines.push({
        ...allocateCost(
          ctx.translate("costs.sharedMeterLine", {
            costTypeName: costType.name,
            meterLabel: shared.label,
          }),
          "per_living_area",
          cents,
          allocationContext,
        ),
        costTypeId: costType.id,
      });
    }
  });

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
    waterDetail: WaterDetail | undefined;
    tenantPeriod: Period;
    waterMeters: MeterBundle[];
    waterWarnings: CalcWarning[];
    kwhMeters: MeterBundle[];
    kwhWarnings: CalcWarning[];
    translate: TranslateFn;
  },
): CostLineResult[] => {
  const lines: CostLineResult[] = [];
  const allocationContext = {
    units: ctx.units,
    targetUnitId: ctx.targetUnitId,
    waterDetail: ctx.waterDetail,
    translate: ctx.translate,
  };

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

    const isKwh = costType.allocationKey === "per_consumption_kwh";
    let meters: MeterBundle[] = [];
    if (isKwh) {
      meters = ctx.kwhMeters;
    } else if (costType.allocationKey === "per_consumption_m3") {
      meters = ctx.waterMeters;
    }

    const assigned = assignedMeters(costType, meters);

    if (isKwh && assigned.length === 0) {
      throw new CalculationError("allocationKwhNoMeters", {
        costTypeName: costType.name,
      });
    }

    // Ohne Zuordnung rechnet eine m3-Kostenart mit allen Wasserzählern.
    if (assigned.length === 0) {
      lines.push({
        ...allocateCost(
          costType.name,
          costType.allocationKey,
          totalAmountCents,
          allocationContext,
        ),
        costTypeId: costType.id,
      });
      continue;
    }

    lines.push(
      ...buildAssignedLines(costType, totalAmountCents, period, {
        ...allocationContext,
        tenantPeriod: ctx.tenantPeriod,
        assigned,
        meters,
        warnings: isKwh ? ctx.kwhWarnings : ctx.waterWarnings,
      }),
    );
  }

  return lines;
};

/**
 * Führt die Hinweise der Wasserberechnung zusammen und ergänzt bzw. streicht,
 * was von den Zählerzuordnungen der m3-Kostenarten abhängt.
 */
const mergeWaterWarnings = (
  warnings: CalcWarning[],
  costTypes: StatementCalculationInput["costTypes"],
  waterMeters: MeterBundle[],
  period: Period,
): CalcWarning[] => {
  const waterCostTypes = costTypes.filter(
    (costType) => costType.allocationKey === "per_consumption_m3",
  );
  const assignedWaterMeterIds = new Set(
    waterCostTypes.flatMap((costType) =>
      assignedMeters(costType, waterMeters).map((bundle) => bundle.meter.id),
    ),
  );
  const unassigned: CalcWarning[] = [];

  // Sobald mit Zuordnungen gearbeitet wird, zählt ein Zähler ohne
  // Zuordnung nirgends mit, z.B. der vergessene Warmwasserzähler neben
  // dem zugeordneten Kaltwasserzähler.
  if (assignedWaterMeterIds.size > 0) {
    for (const { meter } of waterMeters) {
      const countsForUnits =
        meter.role === "common" ||
        ((meter.role === "unit" || meter.role === "virtual_difference") &&
          Boolean(meter.unitId));

      if (
        countsForUnits &&
        !assignedWaterMeterIds.has(meter.id) &&
        overlapsPeriod(meter, period.start, period.end)
      ) {
        unassigned.push({
          code: "waterMeterUnassigned",
          params: { label: meter.label },
        });
      }
    }
  }

  // Der Hinweis auf den mitverteilten Allgemeinzähler gilt nur, solange
  // eine m3-Kostenart ohne Zuordnung mit allen Wasserzählern rechnet.
  const usesAllWaterMeters = waterCostTypes.some(
    (costType) =>
      costType.costs.length > 0 &&
      assignedMeters(costType, waterMeters).length === 0,
  );

  return dedupe([...warnings, ...unassigned]).filter(
    (warning) =>
      usesAllWaterMeters || warning.code !== "commonConsumptionUnallocated",
  );
};

/**
 * Orchestriert die komplette Nebenkostenabrechnung für einen Tenant.
 *
 * Ablauf:
 * 1. Wasserverbrauch berechnen (nötig für per_consumption_m3), entfällt ohne
 *    Wasserzähler und ohne Verbrauchsumlage
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
    kwhMeters = [],
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
  const needsWater =
    waterMeters.length > 0 ||
    costTypes.some(
      (costType) =>
        costType.allocationKey === "per_consumption_m3" &&
        costType.costs.length > 0,
    );
  const waterDetail = needsWater
    ? calculateWater({
        units,
        waterMeters,
        periodStart: period.start,
        periodEnd: period.end,
        targetUnitId,
        tenantPeriodStart: tenantPeriod?.start,
        tenantPeriodEnd: tenantPeriod?.end,
      })
    : undefined;

  const waterWarnings: CalcWarning[] = [];
  const kwhWarnings: CalcWarning[] = [];

  // 2. Kostenzeilen: Heizkosten (aus HeatingDetail) + umgelegte Betriebskosten.
  const lines: CostLineResult[] = [
    ...(heatingDetail
      ? buildHeatingLines(heatingDetail, targetUnitId, translate)
      : []),
    ...buildOperatingLines(costTypes, period, {
      units,
      targetUnitId,
      waterDetail,
      tenantPeriod: consumptionPeriod,
      waterMeters,
      waterWarnings,
      kwhMeters,
      kwhWarnings,
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

  // Flächenschlüssel ohne Fläche (z. B. Heizfläche überall 0): Der Betrag
  // verteilt sich auf niemanden. Keine stille Umstellung auf die Wohnfläche.
  const costWarnings: CalcWarning[] = lines
    .filter(
      (line) =>
        (line.allocationKey === "per_living_area" ||
          line.allocationKey === "per_heating_area") &&
        line.totalBase <= 0 &&
        line.totalAmountCents !== 0,
    )
    .map((line) => ({
      code: "costAllocationBaseZero",
      params: { label: line.costTypeName },
    }));

  if (lines.length === 0) {
    throw new CalculationError("noCosts");
  }

  if (waterDetail && unmeasuredLines.length > 0) {
    waterDetail.warnings = [
      ...(waterDetail.warnings ?? []),
      ...unmeasuredLines.map((line) => ({
        code: "waterNoConsumption",
        params: { label: line.costTypeName },
      })),
    ];
  }

  if (waterDetail) {
    const merged = mergeWaterWarnings(
      [...(waterDetail.warnings ?? []), ...waterWarnings],
      costTypes,
      waterMeters,
      period,
    );

    if (merged.length > 0) {
      waterDetail.warnings = merged;
    } else {
      delete waterDetail.warnings;
    }
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
    ...(kwhWarnings.length > 0 ? { kwhWarnings } : {}),
    ...(costWarnings.length > 0 ? { costWarnings } : {}),
  };
};
